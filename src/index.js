import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import { logger } from 'log';
import TargetClient from '@adobe/target-nodejs-sdk';
import { TransformStream } from 'streams';
import { HtmlRewritingStream } from 'html-rewriter';

// Function to fetch the Adobe Target artifact payload
async function fetchArtifactPayload(url) {
  const response = await httpRequest(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to fetch artifact payload: ${response.status}`);
  }
  const json = await response.json();
  return json;
}


// Function to create and initialize the Adobe Target client

const createTargetClient = async (artifactPayload) => {
  return new Promise((resolve) => {
    const result = TargetClient.create({
      client: '',
      organizationId: '',
      propertyToken: '',
      decisioningMethod: 'on-device',// Use on-device decisioning
      artifactPayload: artifactPayload,
     // artifactLocation: "https://cimage.adobe.com/rules.json",
      pollingInterval: 0,
      targetLocationHint: '34',
      logger: logger,
      fetchApi: httpRequest,
      events: {
        clientReady: () => resolve(result)
      }
    });
  });
};

// Helper function to handle circular references in JSON stringification
function getCircularReplacer() {
  const ancestors = [];
  return function (key, value) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    while (ancestors.length > 0 && ancestors.at(-1) !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return '[Circular]';
    }
    ancestors.push(value);
    return value;
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader && cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    cookies[parts.shift().trim()] = decodeURIComponent(parts.join('='));
  });
  return cookies;
}

// Main function to handle the response
export async function responseProvider(request) {
  try {
    // Fetch the Adobe Target artifact payload
    const artifactUrl = '/rules.json';
    const artifactPayload = await fetchArtifactPayload(artifactUrl);

    // const cookies = parseCookies(request.getHeader('Cookie'));
    // logger.log("targetCookie",targetCookie);
    // const targetCookie = cookies[TargetClient.TargetCookieName];
    
// Define the Target delivery request
    const deliveryRequest = {
      execute: {
        mboxes: [
          {
            index: 0,
            name: 'test-mbox',
            parameters: {
              foo: 'bar'
            }
          }
        ]
      }
    };

    // Create the Target client
    const client = await createTargetClient(artifactPayload);

    //const client = await createTargetClient(artifactPayload);
   // const client = await createTargetClient();

   // Get offers from Target
    const { response } = await client.getOffers({ request: deliveryRequest });


    // Log the Target response
    logger.log('Sending response', JSON.stringify(response, getCircularReplacer()));
    const out = JSON.stringify(response, getCircularReplacer());

   // Parse the Target response to extract relevant information
    const decodedResponse = decodeURIComponent(out);
    let experienceContent, experienceName, optionName;

    try {
      const jsonResponse = JSON.parse(decodedResponse);

      experienceContent = jsonResponse.execute.mboxes[0].options[0].content.experience;
      experienceName = jsonResponse.execute.mboxes[0].options[0].responseTokens['experience.name'];
      optionName = jsonResponse.execute.mboxes[0].options[0].responseTokens['option.name'];
    } catch (error) {
      logger.error('Failed to parse response as JSON: ' + error.message);
    }

    // Fetch the original page from the origin server
    let subrequestHeaders = { "X-Subrequest-Home": ["true"] };
    let url = "https://ewpoc.adobe.com/abc/home.html";

    //CACHE-KEY MODFIED HAS NO REQUEST HEADER
    //SUBREQUEST AND ORIGINAL REQUEST DOES NOT HAVE SAME CACHE KEY
    //INCLUDE HEADER IN CACHE KEY
    //MODIFIED PAGE HAS NO HEADER-cache key will be different-make it no store

    let htmlResponse = await httpRequest(`${url}`, { headers: subrequestHeaders });

    if (!htmlResponse.ok) {
      logger.log(`Failed to fetch doc: ${htmlResponse.status} url ${url}`);
      return createResponse(htmlResponse.status, {}, htmlResponse.body);
    }

    logger.log(`Passed ${url}`);
    let rewriter = new HtmlRewritingStream();

    // Modify the page by adding the experience name to the navbar
    rewriter.onElement('div.navbar', el => {
      el.append(`<a href="#newitem">${experienceName}</a>`);
  });

 // Apply the modifications to the HTML stream
    const transformedStream = htmlResponse.body.pipeThrough(rewriter);

    // Return the modified page
    return createResponse(
      200,
      { 'Content-Type': 'text/html' },
      transformedStream
    );
  } catch (error) {
    logger.error('Error in responseProvider: ' + error.message);
    throw error;
  }
}
