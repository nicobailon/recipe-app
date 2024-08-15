/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/jsx-key */
// @ts-nocheck

"use client";

import {ObjectIcon, VercelIcon} from "@/components/icons";
import {experimental_useObject} from "ai/react";
import {useRef, useState} from "react";
import {motion} from "framer-motion";
import {toast} from "sonner";
import Link from "next/link";
import {Recipe, recipeSchema, PartialRecipe} from "@/app/api/chat/schema";
import {sarcasticResponses} from "./responses.js";
import ImageUpload from '@/components/ImageUpload';
import { Spinner } from '@/components/Spinner';

import RecipeView from "@/components/recipeView";

export default function Home() {
  const [input, setInput] = useState<string>("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  async function validateDish(recipe) {
    try {
      const response = await fetch("/api/isValidDish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({recipe: recipe}),
      });
      const data = await response.json();
      return data.isValid;
    } catch (error) {
      console.error("Error validating dish:", error);
      return false;
    }
  }

  const {submit, isLoading: isLoadingObject, object} = experimental_useObject({
    api: "/api/chat",
    schema: recipeSchema,
    onFinish({object}) {
      if (object) {
        setRecipes((prev) => [object.recipe, ...prev]);
        setInput("");
        inputRef.current?.focus();
      } else {
        console.error("Object is null or undefined");
      }
    },
    onError: (error) => {
      console.error("Error in useObject:", error);
      toast.error("An error occurred. Please try again later.");
    },
  });

  const getSuggestionsFromImage = async (file: File): Promise<string[]> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/analyzeImage', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to analyze image');
    }

    const data = await response.json();
    return data.analysis.suggestions;
  };

  const handleImageUpload = async (file: File) => {
    setUploadedImage(file);
    setIsLoading(true);
    try {
      const suggestions = await getSuggestionsFromImage(file);
      if (suggestions.length > 0) {
        await submit({ recipe: suggestions[0] });
        setSuggestions(suggestions.slice(1));
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error('Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    submit({recipe: suggestion});
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen h-fit bg-white dark:bg-zinc-900">
      <h1 className="text-4xl text-zinc-700 dark:text-zinc-300 py-4 font-semibold">
        Recipe Bro
      </h1>
      <div className="flex flex-col justify-between gap-4 w-full max-w-[600px] px-4">
        <ImageUpload onImageUpload={handleImageUpload} />
        <form
          className="flex flex-col gap-2 relative items-center"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.target as HTMLFormElement;
            const input = form.elements.namedItem("recipe") as HTMLInputElement;
            if (input.value.trim()) {
              setIsValidating(true);
              const isValid = await validateDish(input.value);
              setIsValidating(false);

              if (isValid) {
                submit({recipe: input.value});
              } else {
                setInput("");
                const randomResponse =
                  sarcasticResponses[
                    Math.floor(Math.random() * sarcasticResponses.length)
                  ];
                toast.error(randomResponse);
              }
            }
          }}
        >
          <input
            name="recipe"
            className="bg-zinc-100 rounded-md px-2 py-2 w-full outline-none dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 md:max-w-[600px] max-w-[calc(100dvw-32px)] disabled:text-zinc-400 disabled:cursor-not-allowed placeholder:text-zinc-400 mt-4"
            placeholder="Enter a recipe idea..."
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            disabled={isLoading || isValidating}
            ref={inputRef}
          />
        </form>

        {isLoading && (
          <div className="w-full flex justify-center">
            <Spinner />
          </div>
        )}

        {(recipes.length > 0 || (isLoading && object?.recipe)) && (
          <div className="flex flex-col items-center justify-center w-full">
            <div className="w-full max-w-[600px] px-4 md:px-0">
              {isLoading && object?.recipe && (
                <div className="opacity-75">
                  <RecipeView recipe={object.recipe as PartialRecipe} />
                </div>
              )}

              {recipes.map((recipe, index) => (
                <RecipeView
                  key={`recipe-${index}-${recipe.name}`}
                  recipe={recipe}
                />
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">More Suggestions:</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {!recipes.length && !isLoading && (
          <motion.div className="h-full px-4 w-full md:w-[600px] md:px-0 pt-20">
            <div className="border rounded-lg p-6 flex flex-col gap-4 text-zinc-500 dark:text-zinc-400 dark:border-zinc-700  text-lg justify-center items-center">
              <p>Enter a recipe idea and recipe bro will generate it.</p>
              <p>
                Learn more about the{" "}
                <Link
                  className="text-blue-500 dark:text-blue-400"
                  href="https://sdk.vercel.ai/docs/ai-sdk-ui/object-generation"
                  target="_blank"
                >
                  useObject{" "}
                </Link>
                hook from Vercel AI SDK.
              </p>{" "}
              <p>
                Check out the{" "}
                <Link
                  className="text-blue-500 dark:text-blue-400"
                  href="https://github.com/Abil-Shrestha/recipe-bro"
                  target="_blank"
                >
                  Source Code
                </Link>
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}