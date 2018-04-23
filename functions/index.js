const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')
const express = require('express');

// Twilio Credentials
const accountSid = functions.config().gearfour.twiliosid;
const authToken = functions.config().gearfour.twilioaccount;
const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.post('/createWorkOrder', (req, res) => { doCreateWorkOrder(req, res) });
app.post('/notifyCustomerPickup', (req, res) => { doNotifyCustomerPickup(req, res) });
app.post('/sendMessage/', (req, res) => { doSendMessage(req, res) });
// app.put('/:id', (req, res) => {//...});
// app.delete('/:id', (req, res) => {//...});

exports.api = functions.https.onRequest(app);

function validateWorkOrder(order) {
  return (order.hasOwnProperty("first_name") &&
    order.hasOwnProperty("last_name") &&
    order.hasOwnProperty("phone_number") &&
    order.hasOwnProperty("garage"));
}

function doCreateWorkOrder(req, res) {
  console.log("req.params: ", req.params);
  console.log("req.query: ", req.query);
  const query = req.query;

  if (validateWorkOrder(query)) {
    return db.collection('users').where('phoneNumber', '==', query.phone_number)
    .limit(1)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        return db.collection('users').add({ 
          firstName: query.first_name,
          lastName: query.last_name,
          phoneNumber: query.phone_number,
        });
      }
      // Can only be one user (hopefully)
      let theUser = {};
      snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
        theUser = doc;
      });
      return theUser;
    })
    .then(userDoc => {
      console.log("user: ", userDoc.data());
      return db.collection('workOrders').add({
        customerId: userDoc.id,
        garage: query.garage
      });
    })
    .then(ref => {
      console.log('Added document with ID: ', ref.id);
      return res.send({ status: "Success", id: ref.id });
    })
    .catch(err => {
      console.log("Error: ", err);
      return res.send({ status: "Error", error: err });
    });
  }
  return res.send({ status: "Error processing work order" });
}

function doNotifyCustomerPickup(req, res) {
  console.log("Request: ", req);
  // if (req.query.workId) {

  // }
  return res.send({ status: "Error notifying customer" });
}

function doSendMessage(req, res) {
  console.log("req.query: ", req.query);
  const query = req.query;

  if (query.hasOwnProperty("to") && query.hasOwnProperty("message")) {
    const recipients = JSON.parse(req.query['to']);
    console.log("Recipients: ", recipients, " message: ", req.query.message);
    recipients.forEach(recipient => {
      admin.database().ref('customers/' + recipient)
      .once('value')
      .then(snapshot => {
        if (snapshot.exists()) {
          const number = snapshot.val().phoneNumber;
          console.log("Got customer phone number: ", number);
          return sendMessage(number, req.query.message);
        }
        return null;
      })
      .catch(error => console.log("Error: ", error));
    });
    return res.send({ status: "success" });
  } else {
    return res.send({ status: "error", cause: "Invalid request" });
  }
}

function sendMessage(to, body) {
  return client.messages
  .create({
    to,
    from: '+18333901495',
    body,
  })
  .then(message => console.log(message))
  .catch(err => console.log(err));
}