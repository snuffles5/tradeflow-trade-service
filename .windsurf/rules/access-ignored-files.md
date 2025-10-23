---
trigger: always_on
description: 
globs: 
---

Temporary .gitignore access
When I need to inspect an ignored file (e.g., coverage reports), I may comment out the relevant entries in .gitignore, access the file, complete the required work, and immediately revert .gitignore to its original state using git checkout -- .gitignore (or equivalent) before proceeding.
