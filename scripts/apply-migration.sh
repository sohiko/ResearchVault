#!/bin/bash

# Apply database migration to fix RLS policies
# Usage: ./scripts/apply-migration.sh

echo "Applying database migration to fix RLS policies..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/migrations/006_fix_references_rls.sql" ]; then
    echo "Error: Migration file not found. Please run this script from the project root."
    exit 1
fi

# Apply the migration
echo "Applying migration 006_fix_references_rls.sql..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo ""
    echo "The following issues have been fixed:"
    echo "- References can now be saved with null project_id (uncategorized)"
    echo "- RLS policies updated to handle uncategorized references"
    echo "- Selected texts and bookmarks policies also updated"
    echo ""
    echo "You can now test the extension again."
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
