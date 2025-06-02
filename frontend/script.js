const jobTitleInput = document.getElementById('jobTitleInput');
const companyInput = document.getElementById('companyInput');
const startButton = document.getElementById('startButton');
const interviewArea = document.getElementById('interviewArea');
const questionDisplay = document.getElementById('questionDisplay');
const answerInput = document.getElementById('answerInput');
const answerButton = document.getElementById('answerButton');
const aiFeedback = document.getElementById('aiFeedback');
const nextButton = document.getElementById('nextButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorDisplay = document.getElementById('errorDisplay');
const aiAvatar = document.getElementById('aiAvatar'); // Get the avatar image element

let interviewQuestions = [];
let currentQuestionIndex = 0;
let allFeedback = []; // To store feedback for final evaluation

// Set the source of the avatar image
aiAvatar.src = 'images/robot.png'; // Assuming you have robot.png in frontend/images/

// Initialize the Web Speech API
const synth = window.speechSynthesis;

function speak(text) {
    if (synth.speaking) {
        console.error('speechSynthesis.speaking');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    // You can customize the voice, rate, pitch, etc. here if needed
    synth.speak(utterance);
}

startButton.addEventListener('click', async () => {
    const jobTitle = jobTitleInput.value.trim();
    const company = companyInput.value.trim();

    if (!jobTitle || !company) {
        alert('Please enter job title and company.');
        return;
    }

    // Reset state for a new interview
    interviewQuestions = [];
    currentQuestionIndex = 0;
    allFeedback = [];
    questionDisplay.textContent = '';
    answerInput.value = '';
    answerInput.classList.remove('hidden');
    answerButton.classList.remove('hidden');
    aiFeedback.textContent = '';

    // Remove any previous "Get Final Evaluation" button or final evaluation display
    const finalEvalButton = document.getElementById('finalEvalButton');
    if (finalEvalButton) {
        interviewArea.removeChild(finalEvalButton);
    }
    const finalEvalDisplay = interviewArea.querySelector('.bg-yellow-200');
    if (finalEvalDisplay) {
        interviewArea.removeChild(finalEvalDisplay);
    }

    loadingIndicator.classList.remove('hidden');
    errorDisplay.classList.add('hidden');
    interviewArea.classList.add('hidden');

    try {
        const response = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ job_title: jobTitle, company: company }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch questions.');
        }

        const data = await response.json();
        interviewQuestions = data.questions;
        loadingIndicator.classList.add('hidden');
        interviewArea.classList.remove('hidden');
        displayQuestion();

    } catch (error) {
        console.error('Error fetching questions:', error);
        errorDisplay.textContent = `Error: ${error.message}`;
        errorDisplay.classList.remove('hidden');
        loadingIndicator.classList.add('hidden');
    }
});

answerButton.addEventListener('click', async () => {
    if (!interviewQuestions.length) return;
    const currentQuestion = interviewQuestions[currentQuestionIndex];
    const answer = answerInput.value.trim();
    if (!answer) {
        alert('Please enter your answer.');
        return;
    }

    answerButton.disabled = true;
    nextButton.classList.add('hidden');
    aiFeedback.textContent = 'Evaluating...';
    speak('Evaluating...'); // Speak "Evaluating..."

    try {
        const response = await fetch('http://127.0.0.1:5000/evaluate_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: currentQuestion, answer: answer }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to evaluate answer.');
        }

        const data = await response.json();
        aiFeedback.textContent = data.evaluation;
        speak(data.evaluation); // Speak the AI's feedback
        allFeedback.push({ question: currentQuestion, answer: answer, feedback: data.evaluation }); // Store feedback
        nextButton.classList.remove('hidden');
        answerButton.disabled = false;

    } catch (error) {
        console.error('Error evaluating answer:', error);
        aiFeedback.textContent = `Error: ${error.message}`;
        speak(`Error: ${error.message}`); // Speak the error message
        answerButton.disabled = false;
    }
});

nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    answerInput.value = '';
    aiFeedback.textContent = '';
    nextButton.classList.add('hidden');
    if (currentQuestionIndex < interviewQuestions.length) {
        displayQuestion();
    } else {
        questionDisplay.textContent = 'Interview Finished!';
        speak('Interview Finished!'); // Speak "Interview Finished!"
        answerInput.classList.add('hidden');
        answerButton.classList.add('hidden');

        // Create and show the "Get Final Evaluation" button
        const finalEvalButton = document.createElement('button');
        finalEvalButton.textContent = 'Get Final Evaluation';
        finalEvalButton.className = 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4';
        finalEvalButton.id = 'finalEvalButton'; // Add an ID
        finalEvalButton.addEventListener('click', getFinalEvaluation);
        interviewArea.appendChild(finalEvalButton);
    }
});

async function getFinalEvaluation() {
    loadingIndicator.classList.remove('hidden');
    const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // We could send the history if needed, but the backend currently stores it
        // body: JSON.stringify({ history: allFeedback }),
    });

    loadingIndicator.classList.add('hidden');

    if (!response.ok) {
        const errorData = await response.json();
        errorDisplay.textContent = `Error getting final evaluation: ${errorData.error || 'Something went wrong.'}`;
        speak(`Error getting final evaluation: ${errorData.error || 'Something went wrong.'}`); // Speak the error
        errorDisplay.classList.remove('hidden');
        return;
    }

    const data = await response.json();
    const finalEvalDiv = document.createElement('div');
    finalEvalDiv.className = 'mt-4 p-3 bg-yellow-200 rounded text-gray-700';
    finalEvalDiv.textContent = `Final Evaluation:\n${data.final_evaluation}`;
    speak(`Final Evaluation:\n${data.final_evaluation}`); // Speak the final evaluation
    interviewArea.appendChild(finalEvalDiv);
}

function displayQuestion() {
    if (currentQuestionIndex < interviewQuestions.length) {
        questionDisplay.textContent = `Question ${currentQuestionIndex + 1}: ${interviewQuestions[currentQuestionIndex]}`;
        speak(`Question ${currentQuestionIndex + 1}: ${interviewQuestions[currentQuestionIndex]}`); // Speak the question
    }
}