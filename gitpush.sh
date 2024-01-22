#!/bin/bash

# Prompt for commit message
echo "Enter commit message:"
read commitMessage

# Add all changes to git
git add -A

# Show the status
echo "Git status:"
git status

# Commit the changes
git commit -m "$commitMessage"

# Push to the main branch
echo "Pushing to origin main..."
git push origin main

echo "Done."
