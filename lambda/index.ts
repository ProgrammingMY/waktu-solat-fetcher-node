import { ScheduledEvent, Context } from 'aws-lambda';
import { JakimResponse, PrayerData } from '../utils/types';
import { ZONES } from '../utils/zone';
import { addMonths, getDaysInMonth } from 'date-fns';

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
const sqs = new SQSClient();
const QUEUE_URL = process.env.QUEUE_URL!;


const MAX_RETRY = 1;

const reqUrl = "https://www.e-solat.gov.my/index.php";

async function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const fetchData = async (relativeMonth: number): Promise<any> => {
  const data: PrayerData = {
    jakim: [],
    last_fetched: 0,
  }

  // Get target date
  const fetchDateTarget = addMonths(new Date(), relativeMonth);
  const fetchMonth = fetchDateTarget.getMonth() + 1; // JavaScript months are 0-based
  const fetchYear = fetchDateTarget.getFullYear();
  const lastDayOfMonth = getDaysInMonth(fetchDateTarget);

  console.log(`Total of ${ZONES.length}`);
  console.log(`ℹ️ Fetching for ${fetchDateTarget.toLocaleString('default', { month: 'long' })} ${fetchYear}`);
  console.log('\nStarting\n');

  let attemptCount = 0;
  let remainingCodes = [...ZONES];

  while (remainingCodes.length > 0) {
    if (attemptCount > 0) {
      console.log(`\n💔 Failed to fetch: "${remainingCodes.join('", "')}"`);
      console.log(`\n🔄 Retrying failed requests. Attempt #${attemptCount}\n`);
    }

    if (attemptCount >= MAX_RETRY) {
      console.log(`\n💔 Failed to fetch: "${remainingCodes.join('", "')}"`);
      console.log(`\n🔄 Retrying failed requests. Attempt #${attemptCount}\n`);
      break;
    }

    // Process each zone
    for (const zone of [...remainingCodes]) {
      // make this query params
      const queryParams = new URLSearchParams();
      queryParams.set('r', 'esolatApi/takwimsolat');
      queryParams.set('period', 'duration');
      queryParams.set('zone', zone);

      const payload = `datestart=${fetchYear}-${fetchMonth}-01&dateend=${fetchYear}-${fetchMonth}-${lastDayOfMonth}`;

      try {
        const response = await fetch(`${reqUrl}?${queryParams.toString()}`, {
          method: 'POST',
          body: payload,
          headers: {
            'User-Agent': 'hakim-prayer-times',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
        });

        if (response.status === 200) {
          const jsonResponse = await response.json() as JakimResponse;

          if (jsonResponse.status === 'OK!') {
            console.log(`${zone} : ${jsonResponse.status}`);
            data.jakim.push(jsonResponse);

            // push to queue
            await sqs.send(new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(jsonResponse),
            }));

            // remove from remaining codes
            remainingCodes = remainingCodes.filter(code => code !== zone);
          } else {
            console.log(`${zone} : Failed (${jsonResponse.status}). Skipping for now`);
          }
        } else {
          console.log(`${zone} : Failed (${response.status})`);
        }
      } catch (error) {
        console.log(`${zone} : Failed (${error.message})`);
      }

      // Adding artificial delay
      await sleep(2.0);
    }
    attemptCount++;

    // Set last fetched timestamp
    data.last_fetched = Math.floor(Date.now() / 1000);
    console.log(`\nFetching finish at ${data.last_fetched}`);
  };
}

export const handler = async (event: ScheduledEvent, context: Context): Promise<any> => {
  try {
    // Fetch next month's data
    await fetchData(0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully fetched and stored prayer times',
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error fetching prayer times',
        error: error.message
      }),
    };
  }
}
