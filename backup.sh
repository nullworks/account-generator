BACKUP_FOLDER=backup/$(date +"%s")
mkdir -p $BACKUP_FOLDER
cp accounts.json $BACKUP_FOLDER/accounts.json
cp accounts.cg.json $BACKUP_FOLDER/accounts.cg.json