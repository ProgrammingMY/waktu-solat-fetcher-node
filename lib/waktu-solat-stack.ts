import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import path from 'path';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class WaktuSolatStack extends cdk.Stack {
    public readonly waktuSolatTable: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create DynamoDB table
        const table = new dynamodb.Table(this, 'WaktuSolatTable', {
            partitionKey: { name: 'zoneId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
            maxWriteRequestUnits: 10,
            timeToLiveAttribute: 'ttl',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.waktuSolatTable = table;

        // Create SQS queue
        const queue = new sqs.Queue(this, 'WaktuSolatQueue', {
            visibilityTimeout: cdk.Duration.minutes(3),
            retentionPeriod: cdk.Duration.days(1),
        });

        // Create Fetcher Lambda function
        const fetcherFunction = new NodejsFunction(this, 'WaktuSolatFetcher', {
            functionName: 'WaktuSolatFetcher',
            description: 'Fetch and store waktu solat data',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambda/index.ts'),
            timeout: cdk.Duration.minutes(3),
            environment: {
                QUEUE_URL: queue.queueUrl,
            },
        });

        // Create Processor Lambda function
        const processorFunction = new NodejsFunction(this, 'WaktuSolatProcessor', {
            functionName: 'WaktuSolatProcessor',
            description: 'Process and store waktu solat data',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambda/processor.ts'),
            timeout: cdk.Duration.minutes(3),
            environment: {
                TABLE_NAME: table.tableName,
            },
        });

        // Grant Lambda function permissions to access DynamoDB table
        queue.grantSendMessages(fetcherFunction);
        table.grantWriteData(processorFunction);

        // Add SQS trigger to Processor Lambda function
        processorFunction.addEventSource(new SqsEventSource(queue));

        // Create EventBridge rule to trigger Lambda once a month
        new events.Rule(this, 'MonthlyTrigger', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '0',
                day: '1',
                month: '*',
                year: '*'
            }),
            targets: [new targets.LambdaFunction(fetcherFunction, {
                retryAttempts: 1,
            })],
        });
    }
} 