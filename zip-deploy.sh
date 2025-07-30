#!/bin/bash

# Define the name of the output zip file
ZIP_NAME="nextjs-app-deploy.zip"

# Remove previous zip if it exists
rm -f $ZIP_NAME

# Create zip excluding unnecessary files/folders
zip -r $ZIP_NAME . \
  -x "node_modules/*" \
  -x "node_modules/**" \
  -x ".git/*" \
  -x ".git/**" \
  -x ".next/*" \
  -x ".next/**" \
  -x "repomix-output.txt" \
  -x "sample-data.xml" \
  -x "timesheet-data.xml" \
  -x "test-db.js" \
  -x "env.example" \
  -x "*.tsbuildinfo" \
  -x "mysql.sql" \
  -x "mysql-timetracker.txt"

echo "✅ Project zipped to $ZIP_NAME"

