'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  useEffect(() => {
    // Randomize background position on load and scroll
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
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="space-container flex flex-col items-center max-w-lg w-full">
        <Image 
          src="/assets/logobmii.png" 
          alt="BMI Logo" 
          width={120} 
          height={120}
          className="mb-6"
        />
        
        <h1 className="text-4xl font-bold text-space-text mb-4 text-center">
          Welcome to Our App
        </h1>
        
        <div className="mb-8">
          <p className="text-xl text-space-subtext flex items-center gap-2">
            BMI Calculator Mature 
            <i className="fa-solid fa-leaf text-green-400"></i>
          </p>
        </div>
        
        <div className="space-y-4 w-full">
          <div className="flex justify-center">
            <Link href="/calculator" className="space-button text-lg">
              <i className="fa-solid fa-right-long"></i>
              Try Our Calculator
            </Link>
          </div>
        </div>
        
        <div className="mt-8">
          <Link href="/about" className="text-space-text hover:text-plasma-blue transition-colors flex items-center gap-2">
            <i className="fa-solid fa-receipt"></i>
            About
          </Link>
        </div>
        
        <footer className="mt-12 text-center text-sm text-space-subtext border-t border-container-border pt-6">
          <p>
            <i className="fa-regular fa-copyright text-green-400 mr-1"></i>
            2024-2025 LOGIGO. All rights reserved. Designed by Rezky Nightly.
            <i className="fa-solid fa-champagne-glasses text-purple-400 ml-1"></i>
          </p>
        </footer>
      </div>
    </div>
  );
}