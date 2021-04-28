"use strict";

exports.handler = (event, context, callback) => {
    const { v4: uuidv4 } = require('uuid');
    const AWS = require('aws-sdk');

    AWS.config.update({region: process.env.AWS_REGION});

    if (event.resource === '/license/activate') {
        return licenseActivate(event, callback);
    }
    if (event.resource === '/license/deactivate') {
        return licenseDeactivate(event, callback);
    }
    if (event.resource === '/license/verify') {
        return licenseVerify(event, callback);
    }

    function licenseActivate(event, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

        let bodyData = JSON.parse(event.body);

        var params = {
            TableName: process.env.TABLE_NAME_LICENSE,
            Key: {
                'LICENCE_CODE': {S: bodyData.licence},
            },
            ProjectionExpression: 'LICENCE_CODE,EMAIL,MAX_ACTIVATIONS'
        };

        //Query DynamoDB for license code to activate
        ddb.getItem(params, function(error, data) {
            if (error) {
                return commonResponse({message: "Failed to find Licence Code"}, callback, true);
            } else {
                if (data.Item) {
                    let licenceCode = data.Item.LICENCE_CODE.S;
                    let email = data.Item.EMAIL.S;
                    let maxActivations = data.Item.MAX_ACTIVATIONS.N;

                    //Check and create activation for license code
                    return activateLicenseCode(licenceCode, email, bodyData.uuid, maxActivations, callback);
                } else {
                    return commonResponse({message: "Failed to find Licence Code"}, callback, true);
                }
            }
        });
    }

    function activateLicenseCode(code, email, uuid, maxActivations, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
        var docClient = new AWS.DynamoDB.DocumentClient();

        var params = {
            TableName: process.env.TABLE_NAME_ACTIVATIONS,
            IndexName: 'LICENCE_CODE',
            KeyConditionExpression: '#LICENCECODE = :v_LICENCECODE',
            ExpressionAttributeNames: {
                '#LICENCECODE': 'LICENCE_CODE'
            },
            ExpressionAttributeValues: {
                ':v_LICENCECODE': code
            }
        };

        docClient.query(params, function(error, data) {
            if (error) {
                return commonResponse({message: "Failed to check activations"}, callback, true);
            } else {
                if (data.Items) {
                    // Check existing activations for UUID match
                    for (let activation of data.Items) {
                        console.log('check existing activations')
                        console.log(activation);
                        console.log(uuid);
                        if (activation.MAC_ADDRESS === uuid) {
                            // Existing Activation for UUID found.
                            // Return existing Activation
                            return commonResponse({message: "License Activated", activation_id: activation.ACTIVATION_ID}, callback);
                        }
                    }

                    if (data.Items.length >= maxActivations) {
                        return commonResponse({message: "No activations remaining"}, callback, true);
                    } else {
                        // We have activations remaining and no existing/matching activations found
                        // Create and return a new activation
                        return createNewActivation(code, email, uuid, callback);
                    }
                } else {
                    //No existing activations found. Create new one.
                    return createNewActivation(code, email, uuid, callback);
                }
            }
        });
    }

    function createNewActivation(code, email, uuid, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

        let activationId = uuidv4();
        var params = {
            TableName: process.env.TABLE_NAME_ACTIVATIONS,
            Item: {
                'LICENCE_CODE': {S: code},
                'EMAIL': {S: email},
                'ACTIVATION_ID': {S: activationId},
                'MAC_ADDRESS': {S: uuid},
                'CREATED_AT': {N: (Math.floor(Date.now() / 1000).toString())}
            }
        };

        ddb.putItem(params, function(error, data) {
            if (error) {
                return commonResponse({message: "Failed to activate license"}, callback, true);
            } else {
                return commonResponse({message: "License Activated", activation_id: activationId}, callback);
            }
        });
    }

    function licenseDeactivate(event, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

        let data = JSON.parse(event.body);

        var params = {
            TableName: process.env.TABLE_NAME_ACTIVATIONS,
            Key: {
                'ACTIVATION_ID': {S: data.activation_id}
            }
        };

        ddb.deleteItem(params, function(error, ddbData) {
            if (error) {
                console.log("Error", error);
                return commonResponse({message: "Failed to Deactivate License"}, callback, true);
            } else {
                console.log("Success", data);
                return  commonResponse({message: "Successfully Deactivated License"}, callback);
            }
        });
    }

    function licenseVerify(event, callback) {
        var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

        let data = JSON.parse(event.body);

        var params = {
            TableName: process.env.TABLE_NAME_ACTIVATIONS,
            Key: {
                'ACTIVATION_ID': {S: data.activation_id}
            },
            ProjectionExpression: 'LICENCE_CODE,ACTIVATION_ID,MAC_ADDRESS'
        };

        ddb.getItem(params, function(error, ddbData) {
            if (error) {
                return commonResponse({message: "Failed to verify licence and/or activation"}, callback, true);
            } else {
                console.log(ddbData);
                if (ddbData.Item && ddbData.Item.LICENCE_CODE.S === data.licence && ddbData.Item.MAC_ADDRESS.S === data.uuid) {
                    return commonResponse({message: "Licence and Activation Verified"}, callback);
                } else {
                    return commonResponse({message: "Failed to verify licence and/or activation"}, callback, true);
                }
            }
        });
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
