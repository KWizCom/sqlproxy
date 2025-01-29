import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { isNullOrEmptyString } from "@kwiz/common";
import { Connection, ConnectionConfig, Request } from "tedious";

enum errorCodes {
    Unknown = -1,
    MissingFromParameter = 101,
    MissingConnection = 200,
    ConnectionError = 201,
    InvalidSelectColumns = 102,
    InvalidFrom = 103
};

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');

    let currentUser = "Anonymous user";

    return new Promise<any[]>((resolve, reject) => {
        let resolved = false;
        let onError = (code: errorCodes, message: string) => {
            if (resolved) return;
            resolved = true;
            reject({ code: code, message: message, help: `Supported parameters: ?select=FirstName,LastName&top=20&from=SalesLT.Customer` });
        };
        let onSuccess = (rows: any[]) => {
            if (resolved) return;
            resolved = true;
            resolve(rows);
        };
        try {
            /** if you want to enable authentication, and check the current user name: */
            let currentUserParam = req.headers['x-ms-client-principal-name'];
            if (!isNullOrEmptyString(currentUserParam)) currentUser = currentUserParam;
            context.log(`Accessed by ${currentUser}`);

            let selectColumns = isNullOrEmptyString(req.query.select) ? [] : req.query.select.split(',');
            for (let i = 0; i < selectColumns.length; i++) {
                if (!IsQueryParamOK(selectColumns[i])) {
                    onError(errorCodes.InvalidSelectColumns, "Select columns contains a potentially dangerous value");
                    return;
                }
            }
            let topParam = "";
            let top = isNullOrEmptyString(req.query.top) ? null : parseInt(req.query.top, 10);
            if (!isNaN(top) && top > 0) {
                topParam = ` TOP (${top}) `;
            }

            let from = isNullOrEmptyString(req.query.from) ? null : req.query.from;
            if (isNullOrEmptyString(from)) {
                onError(errorCodes.MissingFromParameter, "Missing from parameter for query");
                return;
            }
            else if (!IsQueryParamOK(from)) {
                onError(errorCodes.InvalidFrom, "From contains a potentially dangerous value");
                return;
            }

            let where = isNullOrEmptyString(req.query.where) ? null : req.query.where;
            let whereParam = "";
            if (isNullOrEmptyString(where)) {
                //ignore it.. all good.
            }
            else if (!IsQueryParamOK(where)) {
                onError(errorCodes.InvalidFrom, "Where contains a potentially dangerous value");
                return;
            }
            else {
                //parse where statement into a new parameter
                whereParam = ` WHERE ${where}`;
            }

            let connectionConfig = GetConnectionString(currentUser);
            if (!connectionConfig) {
                onError(errorCodes.MissingConnection, "Could not find a connection configuration");
            }
            else {
                const connection = new Connection({
                    ...connectionConfig
                });

                // Attempt to connect and execute queries if connection goes through
                connection.on("connect", err => {
                    if (err) {
                        context.log.error(`error: ${errorCodes.ConnectionError}: ${err.message}`);
                        onError(errorCodes.ConnectionError, "Connection error");
                    } else {
                        // Read all rows from table
                        const request = new Request(
                            `SELECT ${topParam}
  ${selectColumns.length < 1 ? "*" : selectColumns.map(c => `[${c}]`).join(',')}
  FROM ${from.split('.').map(c => `[${c}]`).join('.')}
  ${whereParam}`,
                            (err, rowCount) => {
                                if (err) {
                                    context.log.error(`error: ${errorCodes.ConnectionError}: ${err.message}`);
                                    onError(errorCodes.ConnectionError, "Select error");
                                } else {
                                    context.log(`Query result ${rowCount} row(s) returned`);
                                    onSuccess(_rows);
                                }
                            }
                        );

                        var _rows: any[] = [];
                        request.on("row", columns => {
                            let row: { [key: string]: any } = {};
                            columns.forEach(column => {
                                let colValue = column.value;
                                if (column.metadata.type.name === "VarBinary") {
                                    //need it in base64
                                    colValue = Buffer.from(colValue).toString('base64');
                                }
                                row[column.metadata.colName] = colValue;
                            });
                            _rows.push(row);
                        });

                        // //SQL might optimize a query and keep it as a stored procedure, so instead of done it will call doneInProc
                        // request.on("done", () => onSuccess(_rows));
                        // request.on("doneInProc", () => onSuccess(_rows));
                        // request.on("doneProc", () => onSuccess(_rows));

                        connection.execSql(request);
                    }
                });

                connection.connect();
            }

        } catch (e) {
            onError(errorCodes.Unknown, "Unexpected exception occured");
        }
    }).then(rows => {
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: {
                data: rows,
                user: currentUser
            }
        };
    }).catch(error => {
        context.res = {
            status: 400,
            body: error,
        };
    });
};

function GetConnectionString(userName?: string): ConnectionConfig {
    let connectionStringPrefix = "SQLAZURECONNSTR";
    if (!isNullOrEmptyString(userName) && userName.indexOf('@') > 0) {
        //try to get this tenant's connection
        let tenantConnectionStringName = userName.split('@')[1].replace(/\./g, "_").toLowerCase();//replace . with _ in the domain

        let tenantConnectionString = process.env[`${connectionStringPrefix}_${tenantConnectionStringName}`];
        if (!isNullOrEmptyString(tenantConnectionString)) {
            try {
                var c = JSON.parse(tenantConnectionString) as ConnectionConfig;
                if (c && c.authentication && c.authentication.type)
                    return c;
            }
            catch (e) { }
        }
    }
    let demoConnectionStringName = "AdventureWorks";
    let demoConnectionString = process.env[`${connectionStringPrefix}_${demoConnectionStringName}`];
    if (!isNullOrEmptyString(demoConnectionString))
        try {
            var c = JSON.parse(demoConnectionString) as ConnectionConfig;
            if (c && c.authentication && c.authentication.type)
                return c;
        }
        catch (e) { }

    return null;
}

const dangerousSQLCharacters = ['[', ']', '\n',];
const dangerousSQLStrings = ['[', ']', '\n',
    '--', '/*', '#',//comments
    'then ', 'else ', 'case ', 'when ', 'where ',//conditions
    'waitfor ', 'delay ', ' sleep(',//time delay
    'select ', 'from ', 'update ', 'insert ', 'drop ', 'orderby ', 'limit ', 'top ', 'offset ',//commands
];
function IsQueryParamOK(param: string) {
    let paramLower = param.toLowerCase();
    for (let i = 0; i < dangerousSQLStrings.length; i++) {
        if (paramLower.indexOf(dangerousSQLStrings[i]) >= 0)
            return false;
    }
    return true;
}

export default httpTrigger;