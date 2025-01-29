import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { isNullOrEmptyString } from "@kwiz/common";
import axios, { AxiosResponse } from "axios";


const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    try {

        /** if you want to enable authentication, and check the current user name: */
        let currentUser = req.headers['x-ms-client-principal-name'];
        if (isNullOrEmptyString(currentUser)) currentUser = "Anonymous user";
        context.log(`Accessed by ${currentUser}`);

        const postId = (req.query.id || (req.body && req.body.id));
        if (postId > 0)//retrieve a single post
        {
            let result: AxiosResponse = await axios.get(`https://jsonplaceholder.typicode.com/posts/${postId}`);
            context.res = {
                // status: 200, /* Defaults to 200 */
                body: result.data
            };
        }
        else if (postId === 'blow') {
            throw "Ka - Boom!";
        }
        else {
            // get some posts
            let result: AxiosResponse = await axios.get(`https://jsonplaceholder.typicode.com/posts`);
            context.res = {
                // status: 200, /* Defaults to 200 */
                body: result.data
            };
        }
    } catch (e) {
        context.res = {
            status: 400,
            body: e
        };
    }
};

export default httpTrigger;