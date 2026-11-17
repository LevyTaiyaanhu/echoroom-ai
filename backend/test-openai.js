import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();

async function testAPI() {
  try {
    console.log("Testing OpenAI API with official SDK...");
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say hello!" }],
    });

    console.log("Success!");
    console.log(completion.choices[0].message.content);
  } catch (error) {
    console.error("OpenAI test failed:", error.message);
  }
}

testAPI();