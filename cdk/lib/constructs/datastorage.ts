/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import { ObjectOwnership } from "@aws-cdk/aws-s3";
import { Effect, PolicyStatement, AnyPrincipal } from "@aws-cdk/aws-iam";

interface Props {
  datasetsBucketName: string;
}

export class DatasetStorage extends cdk.Construct {
  public readonly datasetsBucket: s3.Bucket;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id);

    this.datasetsBucket = new s3.Bucket(scope, "DatasetsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      serverAccessLogsPrefix: "access_logs/",
      objectOwnership: ObjectOwnership.OBJECT_WRITER,

      /**
       * Ideally, one would leave the bucket name to be autogenerated by CF. But
       * sometimes that creates circular dependencies and the only way to handle
       * them is to have a predictable resource name.
       *
       * Source:
       * https://aws.amazon.com/blogs/infrastructure-and-automation/handling-circular-dependency-errors-in-aws-cloudformation
       *
       * In this case, this bucket is being referenced in the Auth stack to give
       * Cognito Auth Role permissions to read/write to it, but the Backend stack
       * already has a dependency on the Auth stack due to the Cognito User Pool,
       * hence we cannot make the Auth stack depend on the Backend stack or a
       * circular dependency is created.
       */
      bucketName: props.datasetsBucketName,
      /**
       * CORS policy taken from Amplify Docs.
       * This bucket policy allows file uploads from the web browser.
       * https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-s3.CorsRule.html
       */
      cors: [
        {
          maxAge: 3000,
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          exposedHeaders: [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "ETag",
          ],
        },
      ],
    });

    this.datasetsBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ["s3:*"],
        principals: [new AnyPrincipal()],
        resources: [this.datasetsBucket.arnForObjects("*")],
        conditions: {
          Bool: {
            "aws:SecureTransport": false,
          },
        },
      })
    );
  }
}
