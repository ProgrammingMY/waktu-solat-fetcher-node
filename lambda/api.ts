import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    QueryCommand,
    QueryCommandInput
} from "@aws-sdk/lib-dynamodb";

const ddb = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Get query parameters
        const { zone, date } = event.queryStringParameters || {};

        if (!zone || !date) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // CORS support
                },
                body: JSON.stringify({ error: 'Zone and date parameter is required' })
            };
        }

        // check if date is valid, format: DD-MMM-YYYY
        const dateRegex = /^\d{2}-\w{3}-\d{4}$/;
        if (!dateRegex.test(date)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Invalid date format' })
            };
        }


        let queryParams: QueryCommandInput = {
            TableName: TABLE_NAME,
            KeyConditionExpression: 'zoneId = :zoneId and #date = :date',
            ExpressionAttributeValues: {
                ':zoneId': zone,
                ':date': date
            },
            ExpressionAttributeNames: {
                '#date': 'date'
            }
        };

        const response = await docClient.send(new QueryCommand(queryParams));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response.Items)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};