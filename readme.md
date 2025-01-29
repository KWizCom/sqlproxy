This repo has samples to creating a proxy service for SQL data base to be used by KWIZ external data sources.
You should enable MSAL authenticaiton, once published to your Azure environment.

> Read more: https://docs.kwizcom.com/link/557/kb-data-view-plus-using-sql-server-as-an-external-data-source

To get started, clone this repository then run the restore script (or, `npm ci`)

Add connections in the applicaiton settings.

During development, create a `local.settings.json` with connection strings for you to test with:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SQLAZURECONNSTR_CONN1": "connection string...",
    "SQLAZURECONNSTR_CONN2": "connection string...",
    "SQLAZURECONNSTR_CONN3": "connection string...",
  }
}
```

/db folder has a sample to proxying a SQL data base
- this is a generic sample implementation, that gets the connection and query to run
- you might want to consider building specific implementations and wrappers around your unique database business logic
- you have the option to block some or all calls for anonymouse users, by checking the logged in user name (see example in the code)
/posts folder has a sample function to proxying a REST service