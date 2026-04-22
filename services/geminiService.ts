
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProductDescription = async (productName: string, category: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escribe una descripción de venta corta, atractiva y profesional (máximo 25 palabras) para un producto llamado "${productName}" de la categoría "${category}". En español de Perú.`,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "No se pudo generar la descripción.";
  } catch (error) {
    console.error("Error generating description:", error);
    return "Error al conectar con el servicio de IA.";
  }
};
