document.getElementById('show-pw').addEventListener('click', function() {
    var passwordField = document.getElementById('new-password');
    var showPwButton = document.getElementById('show-pw');
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        showPwButton.textContent = 'Hide Password';
    } else {
        passwordField.type = 'password';
        showPwButton.textContent = 'Show Password';
    }
});