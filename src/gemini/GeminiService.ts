import { GoogleGenAI } from "@google/genai";
import envConfig from "../config/envConfig.js";

class GeminiService {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor() {
    if (!envConfig.GOOGLE_GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }

    // Initialize the official Google Gen AI client
    this.ai = new GoogleGenAI();
    // Use the standard recommended production model
    this.modelName = "gemini-3.8-flash";
  }

  /**
   * Generates text content based on a text prompt.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generateText(prompt: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error("Failed to generate content from AI model.");
    }
  }
}

export default new GeminiService();
