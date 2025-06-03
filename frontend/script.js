import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const avatarCanvas = document.getElementById('avatar-canvas');

let interviewQuestions = [];
let currentQuestionIndex = 0;
let allFeedback = [];

// Initialize three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, avatarCanvas.clientWidth / avatarCanvas.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: avatarCanvas, alpha: true }); // alpha: true for transparent background
renderer.setSize(avatarCanvas.clientWidth, avatarCanvas.clientHeight);
camera.position.set(0, 0.5, 1.5); // Adjust camera position
scene.add(new THREE.AmbientLight(0x404040));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Load the GLTF model
const gltfLoader = new GLTFLoader();
const avatarUrl = 'https://models.readyplayer.me/683e288ef869a1762214c735.glb'; // Your avatar URL
let avatarModel;

gltfLoader.load(avatarUrl, (gltf) => {
    avatarModel = gltf.scene;
    scene.add(avatarModel);

    // Basic adjustments
    avatarModel.scale.set(0.3, 0.3, 0.3);
    avatarModel.position.set(0, 0, 0);

    animate();
}, (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}, (error) => {
    console.error('An error happened', error);
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Web Speech API for voice
const synth = window.speechSynthesis;

function speak(text) {
    if (synth.speaking) {
        console.error('speechSynthesis.speaking');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
}

startButton.addEventListener('click', async () => {
    console.log('Start button clicked!'); // Test if the button is clicked
    const jobTitle = jobTitleInput.value.trim();
    const company = companyInput.value.trim();

    if (!jobTitle || !company) {
        alert('Please enter job title and company.');
        return;
    }

    interviewQuestions = [];
    currentQuestionIndex = 0;
    allFeedback = [];
    questionDisplay.textContent = '';
    answerInput.value = '';
    answerInput.classList.remove('hidden');
    answerButton.classList.remove('hidden');
    aiFeedback.textContent = '';

    const finalEvalButton = document.getElementById('finalEvalButton');
    if (finalEvalButton) interviewArea.removeChild(finalEvalButton);
    const finalEvalDisplay = interviewArea.querySelector('.bg-yellow-200');
    if (finalEvalDisplay) interviewArea.removeChild(finalEvalDisplay);

    loadingIndicator.classList.remove('hidden');
    errorDisplay.classList.add('hidden');
    interviewArea.classList.remove('hidden');

    try {
        const response = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_title: jobTitle, company: company }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch questions.');
        const data = await response.json();
        interviewQuestions = data.questions;
        loadingIndicator.classList.add('hidden');
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
    if (!answer) { alert('Please enter your answer.'); return; }

    answerButton.disabled = true;
    nextButton.classList.add('hidden');
    aiFeedback.textContent = 'Evaluating...';
    speak('Evaluating...');

    try {
        const response = await fetch('http://127.0.0.1:5000/evaluate_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: currentQuestion, answer: answer }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to evaluate answer.');
        const data = await response.json();
        aiFeedback.textContent = data.evaluation;
        speak(data.evaluation);
        allFeedback.push({ question: currentQuestion, answer: answer, feedback: data.evaluation });
        nextButton.classList.remove('hidden');
        answerButton.disabled = false;
    } catch (error) {
        console.error('Error evaluating answer:', error);
        aiFeedback.textContent = `Error: ${error.message}`;
        speak(`Error: ${error.message}`);
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
        speak('Interview Finished!');
        answerInput.classList.add('hidden');
        answerButton.classList.add('hidden');

        const finalEvalButton = document.createElement('button');
        finalEvalButton.textContent = 'Get Final Evaluation';
        finalEvalButton.className = 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4';
        finalEvalButton.id = 'finalEvalButton';
        finalEvalButton.addEventListener('click', getFinalEvaluation);
        interviewArea.appendChild(finalEvalButton);
    }
});

async function getFinalEvaluation() {
    loadingIndicator.classList.remove('hidden');
    try {
        const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to get final evaluation.');
        const data = await response.json();
        const finalEvalDiv = document.createElement('div');
        finalEvalDiv.className = 'mt-4 p-3 bg-yellow-200 rounded text-gray-700';
        finalEvalDiv.textContent = `Final Evaluation:\n${data.final_evaluation}`;
        speak(`Final Evaluation:\n${data.final_evaluation}`);
        interviewArea.appendChild(finalEvalDiv);
    } catch (error) {
        console.error('Error getting final evaluation:', error);
        errorDisplay.textContent = `Error getting final evaluation: ${error.message}`;
        speak(`Error getting final evaluation: ${error.message}`);
        errorDisplay.classList.remove('hidden');
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function displayQuestion() {
    if (currentQuestionIndex < interviewQuestions.length) {
        questionDisplay.textContent = `Question ${currentQuestionIndex + 1}: ${interviewQuestions[currentQuestionIndex]}`;
        speak(`Question ${currentQuestionIndex + 1}: ${interviewQuestions[currentQuestionIndex]}`);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);