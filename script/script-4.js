// Smooth scroll for "scroll-top" button
document.querySelector('.scroll-top').addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Function for blog button (can be customized)
document.getElementById('blogButton').addEventListener('click', function() {
    window.location.href = 'https://github.com/oxyzenQ'; // Ganti URL sesuai halaman blog Anda
});