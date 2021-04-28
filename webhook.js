"use strict";

exports.handler = (event, context, callback) => {
    const querystring = require('querystring');
    const AWS = require('aws-sdk');
    const {verifyPaddleWebhook} = require('verify-paddle-webhook');
    const crypto = require('crypto');

    // Maximum activations allowed per unique machine
    const maxActivations = 5;

    const PUBLIC_KEY =
        `-----BEGIN PUBLIC KEY-----

-----END PUBLIC KEY-----`;

    AWS.config.update({region: process.env.AWS_REGION});

    const data = querystring.parse(event.body);

    if (verifyPaddleWebhook(PUBLIC_KEY, data)) {
        if (data.alert_name) {
            let alertName = data.alert_name;

            if (alertName === 'locker_processed') {
                return processLocker(data, callback);
            }
        }
    } else {
        return commonResponse({message: 'Invalid Signature'}, callback, true);
    }

    /*
    * This method should be used when you have an SDK product that is being processed
    * SDK Product will automatically generate a license code for you.
    */
    function processLocker(data, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
        var params = {
            TableName: process.env.TABLE_NAME_LICENSE,
            Item: {
                'LICENCE_CODE': {S: data.licence},
                'EMAIL': {S: data.email},
                'MAX_ACTIVATIONS': {N: maxActivations.toString()}
            }
        };

        ddb.putItem(params, function(error, data) {
            if (error) {
                return commonResponse({message: "Failed to store license"}, callback, true);
            } else {
                return commonResponse({message: "Processed License"}, callback);
            }
        })
    }

    /*
    * If you do not have an SDK product you should swap the `processLocker` method
    * for the one commented out below.
    * This method will generate the license code for you.
    */

    // function processLocker(data, callback) {
    //     //Generate a new license code
    //     const generatedLicense = generateLicense(data.product_id, maxActivations);
    //
    //     //TODO: Deliver license code to customer
    //     deliverLicense(generatedLicense, data.email);
    //
    //     var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    //     var params = {
    //         TableName: process.env.TABLE_NAME_LICENSE,
    //         Item: {
    //             'LICENCE_CODE': {S: generatedLicense},
    //             'EMAIL': {S: data.email},
    //             'MAX_ACTIVATIONS': {N: maxActivations.toString()}
    //         }
    //     };
    //
    //     ddb.putItem(params, function(error, data) {
    //         if (error) {
    //             return commonResponse({message: "Failed to store license"}, callback, true);
    //         } else {
    //             return commonResponse({message: "Processed and Generated License"}, callback);
    //         }
    //     })
    // }

    function generateLicense(productId, maxActivations) {
        let shasum = crypto.createHash('sha1')
        shasum.update(productId + maxActivations + (Math.floor(Date.now() / 1000).toString()));
        let licenseHash = shasum.digest('hex');
        let licenseCode = chunk_split(licenseHash, 8, '-').toUpperCase();

        return licenseCode;
    }

    function deliverLicense(licenseCode, email) {
        //TODO: License has been generated. Needs delivering to your user

    }

    function chunk_split (body, chunklen, end) {
        // http://kevin.vanzonneveld.net
        // +   original by: Paulo Freitas
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: Theriault
        // *     example 1: chunk_split('Hello world!', 1, '*');
        // *     returns 1: 'H*e*l*l*o* *w*o*r*l*d*!*'
        // *     example 2: chunk_split('Hello world!', 10, '*');
        // *     returns 2: 'Hello worl*d!*'
        chunklen = parseInt(chunklen, 10) || 76;
        end = end || '\r\n';

        if (chunklen < 1) {
            return false;
        }

        let chunked = body.match(new RegExp(".{0," + chunklen + "}", "g")).join(end);
        return chunked.substring(0, chunked.length - 1);
    }

    function commonResponse(response, callback, error = false) {
        let statusCode = 200;

        if (error) {statusCode = 400};

        return callback(null, {
            body: JSON.stringify(response),
            headers: { "Content-Type": "application/json" },
            statusCode: statusCode
        });
    }
};
