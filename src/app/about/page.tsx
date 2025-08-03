'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
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

  return (
    <div className="min-h-screen py-8">
      <div className="space-container max-w-4xl">
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

        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-space-text mb-4">
            About BMI Calculator Mature
          </h1>
          <p className="text-xl text-space-subtext max-w-2xl mx-auto">
            A modern, responsive Body Mass Index calculator with space-themed design, 
            built to help you monitor your health journey.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-calculator text-4xl text-plasma-blue mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Accurate Calculations
              </h3>
              <p className="text-space-subtext">
                Get precise BMI calculations using the standard formula with instant results and category classification.
              </p>
            </div>
          </div>

          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-mobile-alt text-4xl text-plasma-purple mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Mobile Responsive
              </h3>
              <p className="text-space-subtext">
                Fully responsive design that works perfectly on all devices, from smartphones to desktops.
              </p>
            </div>
          </div>

          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-palette text-4xl text-star-glow mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Space Theme
              </h3>
              <p className="text-space-subtext">
                Beautiful space-themed interface with plasma colors and smooth animations for an engaging experience.
              </p>
            </div>
          </div>

          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-shield-alt text-4xl text-green-400 mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Privacy First
              </h3>
              <p className="text-space-subtext">
                All calculations are performed locally in your browser. No data is stored or transmitted to external servers.
              </p>
            </div>
          </div>

          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-bolt text-4xl text-nebula-glow mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Fast & Lightweight
              </h3>
              <p className="text-space-subtext">
                Optimized for performance with minimal loading times and smooth interactions across all devices.
              </p>
            </div>
          </div>

          <div className="space-container">
            <div className="text-center">
              <i className="fa-solid fa-heart text-4xl text-red-400 mb-4"></i>
              <h3 className="text-xl font-semibold text-space-text mb-2">
                Health Focused
              </h3>
              <p className="text-space-subtext">
                Provides clear BMI categories and health guidance to help you understand your results better.
              </p>
            </div>
          </div>
        </div>

        <div className="space-container mb-12">
          <h2 className="text-2xl font-bold text-space-text mb-6 text-center">
            Understanding BMI
          </h2>
          <div className="max-w-3xl mx-auto">
            <Image 
              src="/assets/bmi-chart.gif" 
              alt="BMI Chart" 
              width={600} 
              height={400}
              className="w-full rounded-lg mb-6"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-space-subtext">
              <div>
                <h4 className="text-lg font-semibold text-space-text mb-2">What is BMI?</h4>
                <p className="mb-4">
                  Body Mass Index (BMI) is a simple calculation using a person's height and weight. 
                  The BMI formula divides an adult's weight in kilograms by their height in meters squared.
                </p>
                <p>
                  While BMI doesn't directly measure body fat, it's a useful screening tool for 
                  categorizing weight ranges that may lead to health problems.
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-space-text mb-2">BMI Categories</h4>
                <div className="space-y-2">
                  <p><span className="text-blue-400 font-medium">Underweight:</span> Below 18.5</p>
                  <p><span className="text-green-400 font-medium">Healthy weight:</span> 18.5 - 24.9</p>
                  <p><span className="text-yellow-400 font-medium">Overweight:</span> 25.0 - 29.9</p>
                  <p><span className="text-red-400 font-medium">Obesity:</span> 30.0 and above</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/calculator" className="space-button text-lg">
            <i className="fa-solid fa-calculator mr-2"></i>
            Try the Calculator
          </Link>
        </div>

        <footer className="mt-16 text-center text-sm text-space-subtext border-t border-container-border pt-8">
          <p>
            <i className="fa-regular fa-copyright text-green-400 mr-1"></i>
            2024-2025 LOGIGO. All rights reserved. Designed by Rezky Nightly.
            <i className="fa-solid fa-champagne-glasses text-purple-400 ml-1"></i>
          </p>
          <p className="mt-2">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  );
}