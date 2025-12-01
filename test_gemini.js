const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

async function testGemini() {
    const apiKey = 'AIzaSyCc-h0jWfKK3w7Brzx4TkLe69iEs1nwAVI';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

    // Use the user's uploaded image as "user photo"
    const userImagePath = '/Users/emitripp/.gemini/antigravity/brain/21cd528f-03b6-46c4-891b-ce23912e3dda/uploaded_image_1764549443895.png';
    // Use a local product image (assuming one exists, e.g. optimized mochilla)
    const productImagePath = '/Users/emitripp/Downloads/Legado san josé-1/Fotos/optimized/Mochila.png';

    console.log('Reading images...');
    const userImageBuffer = fs.readFileSync(userImagePath);
    const productImageBuffer = fs.readFileSync(productImagePath);

    const prompt = "Generate a photorealistic image of the person in the first image wearing the product shown in the second image. Maintain the person's pose, facial features, and background. The result should be high quality and look natural.";

    const imageParts = [
        {
            inlineData: {
                data: userImageBuffer.toString('base64'),
                mimeType: 'image/png'
            }
        },
        {
            inlineData: {
                data: productImageBuffer.toString('base64'),
                mimeType: 'image/png'
            }
        }
    ];

    console.log('Sending request to Gemini...');
    try {
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();
        console.log('Success!');
        console.log('Response text:', text);
    } catch (error) {
        console.error('Error details:', error);
        if (error.response) {
            console.error('API Response Error:', JSON.stringify(error.response, null, 2));
        }
    }
}

testGemini();
