document.addEventListener('DOMContentLoaded', () => {

    // Initialize password toggle functionality for login and registration forms
    togglePasswordVisibility('show-pw-login', 'login-password');
    togglePasswordVisibility('show-pw-register', 'register-password');

    // Function to show notifications
    function showNotification(message, type) {
        const successMessage = document.getElementById('success-message');
        const errorMessage = document.getElementById('error-message');
        
        if (type === 'success') {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        } else {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }
    }

    // Function to handle BMI calculations
    function handleBMICalculation() {
        const bmiForm = document.getElementById('bmi-form');
        if (bmiForm) {
            bmiForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const age = document.getElementById('age').value;
                const gender = document.querySelector('input[name="gender"]:checked')?.value;
                const height = document.getElementById('height').value;
                const weight = document.getElementById('weight').value;

                if (!age || !gender || !height || !weight) {
                    alert('Please fill in all fields');
                    return;
                }

                const heightInMeters = height / 100;
                const bmi = weight / (heightInMeters * heightInMeters);
                document.getElementById('bmi-output').textContent = bmi.toFixed(2);

            });
        }
    }

    handleBMICalculation();

    // Reset button functionality
    const form = document.getElementById('bmi-form');
    const resetButton = document.getElementById('reset-button');
    const bmiResult = document.getElementById('bmi-output');
    const status = document.getElementById('status');

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            // Clear form fields
            form.reset();
    
            // Clear BMI result and status
            bmiResult.textContent = '0';
            status.textContent = '--';
        });
    }
});

// Randomize background position
let isScrolling = false;

function randomizeBackgroundPosition() {
    if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
            const xPos = Math.floor(Math.random() * 101); // Between 0% and 100%
            const yPos = Math.floor(Math.random() * 101); // Between 0% and 100%
            document.body.style.backgroundPosition = `${xPos}% ${yPos}%`;
            isScrolling = false;
        });
    }
}

// Randomize background on page load and scroll
window.addEventListener('load', randomizeBackgroundPosition);
window.addEventListener('scroll', randomizeBackgroundPosition);

// Function to calculate BMI and display result
async function calculateBMI() {
    const age = document.getElementById('age').value;
    const gender = document.querySelector('input[name="gender"]:checked');
    const height = document.getElementById('height').value;
    const weight = document.getElementById('weight').value;

    if (age && gender && height && weight) {
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        let bmiCategory = '';
        let categoryClass = '';

        if (bmi < 18.5) {
            bmiCategory = 'Underweight';
            categoryClass = 'underweight';
        } else if (bmi >= 18.5 && bmi < 24.9) {
            bmiCategory = 'Healthy weight';
            categoryClass = 'healthy';
        } else if (bmi >= 25 && bmi < 29.9) {
            bmiCategory = 'Overweight';
            categoryClass = 'overweight';
        } else {
            bmiCategory = 'Obesity';
            categoryClass = 'obesity';
        }

        const bmiOutput = document.getElementById('bmi-output');
        bmiOutput.textContent = `${bmi.toFixed(2)} (${bmiCategory})`;
        bmiOutput.className = categoryClass;

    } else {
        alert('Please fill out all fields.');
    }
}

// comment for smooth scrolling , enable on style-4.css
//document.addEventListener('DOMContentLoaded', () => {
//   const scrollUpLink = document.getElementById('scroll-up-link');
//    
//    if (scrollUpLink) {
//        scrollUpLink.addEventListener('click', (event) => {
//            event.preventDefault(); // Prevent default anchor behavior
//           document.querySelector(scrollUpLink.getAttribute('href')).scrollIntoView({
//                behavior: 'smooth'
//            });
//        });
//    }
//});