
      #!/bin/bash
      echo "Initializare VM"
      # Adăugare nume companie în baza de date
      mysql -u root -p'password' -e "USE erp_db; INSERT INTO companies (name) VALUES ('mareletest5');"
    