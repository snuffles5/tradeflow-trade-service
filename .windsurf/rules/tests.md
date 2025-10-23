---
trigger: always_on
description: 
globs: 
---

* __Rules summary__  
  Update or expand tests whenever existing code changes.  
  Write comprehensive tests alongside any new code.  
  Remove tests that no longer apply when code is deleted.

* __Container reminder__  
  After modifying code, run `tflow-rebuild` to execute:  
  1. `mvn clean verify`  
  2. `docker-compose up --build`