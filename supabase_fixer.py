#!/usr/bin/env python3
"""
Supabase Configuration Validator and Fixer for SimpliBiz

This script will:
1. Check and correct the database schema for products table
2. Verify and create necessary RLS policies
3. Set up the storage bucket with appropriate policies

Requirements:
- supabase-py (pip install supabase)
- python-dotenv (pip install python-dotenv)

Usage:
    python supabase_fixer.py check   # Only checks for issues without fixing
    python supabase_fixer.py fix     # Checks and applies fixes for identified issues
"""

import os
import sys
import json
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py package is not installed.")
    print("Please install it using: pip install supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.environ.get("REACT_APP_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("REACT_APP_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase environment variables not found.")
    print("Please ensure your .env file contains REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def run_sql_query(query: str) -> Dict:
    """Run a SQL query using the Supabase REST API"""
    try:
        response = supabase.rpc("exec_sql", {"query": query}).execute()
        return response
    except Exception as e:
        print(f"Error executing SQL: {e}")
        return {"error": str(e)}


def check_products_table() -> List[Dict]:
    """Check if products table has category_id column"""
    issues = []
    
    # Check products table structure
    query = """SELECT column_name, is_nullable 
              FROM information_schema.columns 
              WHERE table_name = 'products';"""
    
    try:
        response = run_sql_query(query)
        columns = response.get("data", [])
        
        category_col = next((col for col in columns if col["column_name"] == "category_id"), None)
        if category_col:
            issues.append({
                "type": "schema",
                "description": "The category_id column still exists in the products table",
                "fix_query": """
                    -- First remove the foreign key constraint
                    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
                    
                    -- Then remove the category_id column
                    ALTER TABLE products DROP COLUMN IF EXISTS category_id;
                """
            })
        
        print(f"✓ Database schema check complete. Found {len(issues)} issue(s).")
        return issues
    
    except Exception as e:
        print(f"Error checking products table: {e}")
        issues.append({
            "type": "error",
            "description": f"Failed to check products table structure: {str(e)}",
            "fix_query": None
        })
        return issues


def check_rls_policies() -> List[Dict]:
    """Check if RLS is enabled and necessary policies are in place"""
    issues = []
    
    # Check if RLS is enabled on products table
    query = """SELECT relname, relrowsecurity 
              FROM pg_class 
              WHERE relname = 'products';"""
    
    try:
        response = run_sql_query(query)
        tables = response.get("data", [])
        
        if not tables or not tables[0]["relrowsecurity"]:
            issues.append({
                "type": "rls",
                "description": "Row Level Security is not enabled on the products table",
                "fix_query": "ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;"
            })
        
        # Check for INSERT policy
        query = """SELECT policyname, cmd 
                  FROM pg_policies 
                  WHERE tablename = 'products' AND cmd = 'INSERT';"""
                  
        response = run_sql_query(query)
        policies = response.get("data", [])
        
        if not policies:
            issues.append({
                "type": "rls",
                "description": "No INSERT policy exists for the products table",
                "fix_query": """
                    CREATE POLICY "Enable insert for authenticated users"
                    ON public.products
                    FOR INSERT
                    TO authenticated
                    WITH CHECK (auth.uid() = user_id);
                """
            })
        
        print(f"✓ RLS policy check complete. Found {len(issues)} issue(s).")
        return issues
    
    except Exception as e:
        print(f"Error checking RLS policies: {e}")
        issues.append({
            "type": "error",
            "description": f"Failed to check RLS policies: {str(e)}",
            "fix_query": None
        })
        return issues


def check_storage_bucket() -> List[Dict]:
    """Check if product-images bucket exists with proper policies"""
    issues = []
    
    try:
        # Check if bucket exists
        response = supabase.storage.list_buckets().execute()
        buckets = response.get("data", [])
        
        bucket_exists = any(bucket["name"] == "product-images" for bucket in buckets)
        if not bucket_exists:
            issues.append({
                "type": "storage",
                "description": "The product-images bucket does not exist",
                "fix_query": """
                    -- This cannot be done via SQL, but through the Supabase Storage API
                    -- The script will handle this separately
                """,
                "fix_action": "create_bucket"
            })
        
        # Check storage policies
        query = """SELECT name, definition 
                  FROM storage.policies 
                  WHERE definition::text LIKE '%product-images%';"""
                  
        response = run_sql_query(query)
        policies = response.get("data", [])
        
        has_insert_policy = any("INSERT" in policy["definition"] for policy in policies)
        has_select_policy = any("SELECT" in policy["definition"] for policy in policies)
        
        if not has_insert_policy:
            issues.append({
                "type": "storage",
                "description": "No INSERT policy for product-images bucket",
                "fix_query": """
                    CREATE POLICY "Allow authenticated user uploads"
                    ON storage.objects FOR INSERT TO authenticated
                    WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
                """
            })
        
        if not has_select_policy:
            issues.append({
                "type": "storage",
                "description": "No SELECT policy for product-images bucket",
                "fix_query": """
                    CREATE POLICY "Allow public read access"
                    ON storage.objects FOR SELECT
                    TO public
                    USING (bucket_id = 'product-images');
                """
            })
        
        print(f"✓ Storage bucket check complete. Found {len(issues)} issue(s).")
        return issues
    
    except Exception as e:
        print(f"Error checking storage bucket: {e}")
        issues.append({
            "type": "error",
            "description": f"Failed to check storage bucket: {str(e)}",
            "fix_query": None
        })
        return issues


def create_storage_bucket() -> bool:
    """Create the product-images bucket"""
    try:
        response = supabase.storage.create_bucket(
            "product-images", 
            {"public": True}
        ).execute()
        
        if "error" in response:
            print(f"Error creating bucket: {response['error']}")
            return False
            
        print("✓ Created product-images bucket successfully")
        return True
    except Exception as e:
        print(f"Error creating bucket: {e}")
        return False


def fix_issues(issues: List[Dict]) -> None:
    """Apply fixes for identified issues"""
    if not issues:
        print("No issues to fix!")
        return
    
    for issue in issues:
        print(f"Fixing: {issue['description']}")
        
        if issue.get("fix_action") == "create_bucket":
            success = create_storage_bucket()
            if success:
                print(f"✓ Fixed: {issue['description']}")
            else:
                print(f"✗ Failed to fix: {issue['description']}")
        elif issue.get("fix_query"):
            try:
                response = run_sql_query(issue["fix_query"])
                if "error" in response:
                    print(f"✗ Failed to fix: {issue['description']} - {response['error']}")
                else:
                    print(f"✓ Fixed: {issue['description']}")
            except Exception as e:
                print(f"✗ Failed to fix: {issue['description']} - {e}")


def main():
    """Main function to check and fix Supabase configuration"""
    mode = "check"  # Default mode
    
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
    
    if mode not in ["check", "fix"]:
        print("Invalid mode. Use 'check' or 'fix'.")
        sys.exit(1)
    
    print("=== SimpliBiz Supabase Configuration Validator ===")
    print(f"Mode: {mode.upper()}")
    print("\nChecking database schema...")
    schema_issues = check_products_table()
    
    print("\nChecking RLS policies...")
    rls_issues = check_rls_policies()
    
    print("\nChecking storage bucket...")
    storage_issues = check_storage_bucket()
    
    all_issues = schema_issues + rls_issues + storage_issues
    
    print("\n=== Summary ===")
    print(f"Total issues found: {len(all_issues)}")
    
    if all_issues:
        print("\nIssues found:")
        for i, issue in enumerate(all_issues, 1):
            print(f"{i}. {issue['description']}")
        
        if mode == "fix":
            print("\nApplying fixes...")
            fix_issues(all_issues)
            print("\nAll fixes applied. Please restart your app and try adding a product again.")
        else:
            print("\nTo fix these issues, run: python supabase_fixer.py fix")
    else:
        print("\nYour Supabase configuration looks good! No issues found.")
    
    print("\nScript execution completed.")


if __name__ == "__main__":
    main()
