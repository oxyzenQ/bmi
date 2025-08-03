'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function CalculatorPage() {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: ''
  });
  const [bmiResult, setBmiResult] = useState<{
    value: number;
    category: string;
    categoryClass: string;
  } | null>(null);

  useEffect(() => {
    // Randomize background position effect
    const randomizeBackgroundPosition = () => {
      const xPos = Math.floor(Math.random() * 101);
      const yPos = Math.floor(Math.random() * 101);
      document.body.style.backgroundPosition = `${xPos}% ${yPos}%`;
    };

    randomizeBackgroundPosition();
    
    let isScrolling = false;
    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
          randomizeBackgroundPosition();
          isScrolling = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateBMI = (e: React.FormEvent) => {
    e.preventDefault();
    
    const { age, gender, height, weight } = formData;
    
    if (!age || !gender || !height || !weight) {
      alert('Please fill in all fields');
      return;
    }

    const heightInMeters = parseFloat(height) / 100;
    const bmi = parseFloat(weight) / (heightInMeters * heightInMeters);
    
    let category = '';
    let categoryClass = '';

    if (bmi < 18.5) {
      category = 'Underweight';
      categoryClass = 'text-blue-400';
    } else if (bmi >= 18.5 && bmi < 24.9) {
      category = 'Healthy weight';
      categoryClass = 'text-green-400';
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      categoryClass = 'text-yellow-400';
    } else {
      category = 'Obesity';
      categoryClass = 'text-red-400';
    }

    setBmiResult({
      value: parseFloat(bmi.toFixed(2)),
      category,
      categoryClass
    });
  };

  const resetForm = () => {
    setFormData({ age: '', gender: '', height: '', weight: '' });
    setBmiResult(null);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="space-container max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-space-text hover:text-plasma-blue transition-colors">
            <i className="fa-solid fa-arrow-left mr-2"></i>
            Back to Home
          </Link>
          <Image 
            src="/assets/logobmii.png" 
            alt="BMI Logo" 
            width={60} 
            height={60}
          />
        </div>

        <h1 className="text-3xl font-bold text-space-text mb-2 text-center">
          BMI Calculator
        </h1>
        <p className="text-space-subtext text-center mb-8">
          Calculate your Body Mass Index and learn about your health status
        </p>

        <form onSubmit={calculateBMI} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="age" className="block text-space-text font-medium mb-2">
                Age (years)
              </label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-space-dark border border-container-border rounded-lg text-space-text focus:outline-none focus:border-plasma-blue transition-colors"
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>

            <div>
              <label className="block text-space-text font-medium mb-2">
                Gender
              </label>
              <div className="flex gap-4">
                <label className="flex items-center text-space-text cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={formData.gender === 'male'}
                    onChange={handleInputChange}
                    className="mr-2 accent-plasma-blue"
                  />
                  <i className="fa-solid fa-person mr-1"></i>
                  Male
                </label>
                <label className="flex items-center text-space-text cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={formData.gender === 'female'}
                    onChange={handleInputChange}
                    className="mr-2 accent-plasma-blue"
                  />
                  <i className="fa-solid fa-person-dress mr-1"></i>
                  Female
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="height" className="block text-space-text font-medium mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                id="height"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-space-dark border border-container-border rounded-lg text-space-text focus:outline-none focus:border-plasma-blue transition-colors"
                placeholder="Enter your height"
                min="50"
                max="300"
              />
            </div>

            <div>
              <label htmlFor="weight" className="block text-space-text font-medium mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-space-dark border border-container-border rounded-lg text-space-text focus:outline-none focus:border-plasma-blue transition-colors"
                placeholder="Enter your weight"
                min="10"
                max="500"
                step="0.1"
              />
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              type="submit"
              className="space-button text-lg"
            >
              <i className="fa-solid fa-calculator"></i>
              Calculate BMI
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-refresh"></i>
              Reset
            </button>
          </div>
        </form>

        {bmiResult && (
          <div className="mt-8 p-6 bg-space-dark rounded-lg border border-container-border text-center">
            <h3 className="text-xl font-semibold text-space-text mb-4">Your BMI Result</h3>
            <div className="text-4xl font-bold mb-2">
              <span className={bmiResult.categoryClass}>{bmiResult.value}</span>
            </div>
            <div className={`text-lg font-medium ${bmiResult.categoryClass}`}>
              {bmiResult.category}
            </div>
            <div className="mt-4 text-sm text-space-subtext">
              <p>BMI Categories:</p>
              <div className="mt-2 text-left max-w-md mx-auto">
                <p className="text-blue-400">• Underweight: Below 18.5</p>
                <p className="text-green-400">• Healthy weight: 18.5 - 24.9</p>
                <p className="text-yellow-400">• Overweight: 25.0 - 29.9</p>
                <p className="text-red-400">• Obesity: 30.0 and above</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/about" className="text-plasma-blue hover:text-nebula-glow transition-colors">
            Learn more about BMI <i className="fa-solid fa-arrow-right ml-1"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}