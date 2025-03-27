import { Context } from "vm";
import { SQSEvent } from 'aws-lambda';
import { JakimResponse, PrayerTime } from "../utils/types";

// dynamo db
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = new DynamoDBClient();

const TABLE_NAME = process.env.TABLE_NAME!;

function getTTL(date: string): number {
    const dateObj = new Date(date);
    dateObj.setHours(dateObj.getHours() + 12);
    return Math.floor(dateObj.getTime() / 1000);
}

function convertToUTCTimestamp(date: string, time: string): number {
    // Combine date and time strings
    const dateTimeStr = `${date} ${time}`;

    // Parse the datetime string to Date object (assuming date format DD-MMM-YYYY)
    const localDateTime = new Date(dateTimeStr);

    // minus 8 hours to convert to UTC for Malaysia
    localDateTime.setHours(localDateTime.getHours() - 8);

    // Convert to UTC timestamp in milliseconds
    return localDateTime.getTime();
}

function processPrayerTime(prayerTime: PrayerTime): Record<string, number> {
    const date = prayerTime.date; // format: DD-MMM-YYYY
    return {
        imsak: convertToUTCTimestamp(date, prayerTime.imsak),
        fajr: convertToUTCTimestamp(date, prayerTime.fajr),
        syuruk: convertToUTCTimestamp(date, prayerTime.syuruk),
        dhuha: convertToUTCTimestamp(date, prayerTime.dhuha),
        dhuhr: convertToUTCTimestamp(date, prayerTime.dhuhr),
        asr: convertToUTCTimestamp(date, prayerTime.asr),
        maghrib: convertToUTCTimestamp(date, prayerTime.maghrib),
        isha: convertToUTCTimestamp(date, prayerTime.isha)
    };
}

async function dataProcessor(message: JakimResponse) {
    const docClient = DynamoDBDocumentClient.from(ddb);
    const zone = message.zone;
    const prayerTimes = message.prayerTime;

    // get month and year
    const month = prayerTimes[0].date.split('-')[1];
    const year = prayerTimes[0].date.split('-')[2];

    // Process items in batches of 25 (DynamoDB batch write limit)
    const batchSize = 25;

    for (let i = 0; i < prayerTimes.length; i += batchSize) {
        const batch = prayerTimes.slice(i, i + batchSize);

        // process batch
        const writeRequests = batch.map(prayerTime => {
            const timestamps = processPrayerTime(prayerTime);
            return {
                PutRequest: {
                    Item: {
                        zoneId: zone,
                        date: prayerTime.date,
                        day: prayerTime.date.split('-')[0],
                        month: month,
                        year: year,
                        ttl: getTTL(prayerTime.date),
                        ...timestamps
                    }
                }
            };
        });

        try {
            const batchWriteCommand = new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: writeRequests
                }
            });

            await docClient.send(batchWriteCommand);

            console.log(`Successfully processed batch of ${writeRequests.length} items for zone ${zone}`);
        } catch (error) {
            console.error(`Error processing batch for zone ${zone}:`, error);
            throw error;
        }
    }
}

export const handler = async (event: SQSEvent, context: Context): Promise<any> => {
    try {
        const message = JSON.parse(event.Records[0].body) as JakimResponse;
        await dataProcessor(message);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully processed prayer times',
            }),
        };
    } catch (error) {
        console.error('Error processing message:', error);
        throw error;
    }
};
