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

# Azure function authentication options

1. You can publish azure functions as anonymous access (default)
1. You can create a function that uses "authLevel": "function"
   Accessing these will require a function token to be sent with the request, and you can then manage these tokens and control
   usage/access to that function

# Publish to azure

Recommended to use VSCode Azure plugins to handle the publish for you.

1. Open the project in VSCode
1. Install the "Azure Functions" and/or "Azure App Service" plugins
1. Follow the instructions to publish your functions or app service into a new or existing bucket in your Azure subscription
1. Enable CORS on your Azure Function/App Service
   - Turn on Enable Access-Control-Allow-Credentials
   - visit the CORS blade and add your SharePoint URL to allow calls from that client under "Allowed Origins", for example: https://tenant.sharepoint.com
   - click save

# notes for developers

## Check logged in user name

If your application requries MSAL login, all users will be required to login first.

However if you allow mixed (anonymous and logged in) - users will not have to login to access your application.
This is useful if you want to export some endpoints to anonymous users and some that requires a login.
In this case - you can check the logged in user name by checking the request header 'x-ms-client-principal-name', and decide if the user has access or not.

If you enabled authentication, you can get the user name using:
`let currentUser = req.headers['x-ms-client-principal-name'];`

## Accessing application configuration:

https://docs.microsoft.com/en-us/azure/app-service/configure-common#connection-strings

To access application settings:
process.env["property"] or process.env.property

To accss a connection string:
You will have to prefix it by type:

SQLServer: SQLCONNSTR*
MySQL: MYSQLCONNSTR*
SQLAzure: SQLAZURECONNSTR*
Custom: CUSTOMCONNSTR*
PostgreSQL: POSTGRESQLCONNSTR\_

process.env["SQLAZURECONNSTR_" + "property"] or process.env.SQLAZURECONNSTR_property