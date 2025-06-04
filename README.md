# mirand-ai
A voice-based mock interview coach that helps you practice and improve through realistic phone interviews and feedback.

# AI Mock Interview Platform

An AI-powered mock interview system featuring realistic 3D avatar interviewers, real-time speech processing, and intelligent feedback generation.

## 🎯 Project Overview

### Core Functionality
- **AI-powered mock interview system** with realistic 3D avatar interviewer
- **Speech-to-text** for voice answers and **text-to-speech** for questions
- **Real-time facial animations** during speech
- **AI evaluation and feedback** using OpenAI and Perplexity APIs

## 🏗️ Architecture

### Backend (Flask)
- **`app.py`** - Main Flask server with CORS enabled
- **`utils.py`** - API integration (Perplexity for questions, OpenAI for evaluation)
- **Session-based interview history** storage
- **Three main endpoints**: `/get_questions`, `/evaluate_answer`, `/get_final_evaluation`

### Frontend (Vanilla JS + Three.js)
- **`index.html`** - Clean UI with Tailwind CSS
- **`script.js`** - Complex Three.js avatar system with facial morphing
- **`styles.css`** - Responsive styling with animations

## ✨ Key Technical Features

### 🤖 3D Avatar System
- Uses **Ready Player Me avatars** with ARKit facial morphs
- **Real-time lip sync** and facial animations during speech
- **Fallback avatar system** for reliability
- Professional lighting and camera controls

### 🎤 Speech Integration
- **Web Speech API** for voice recognition
- **Speech Synthesis API** with customizable voices
- **Synchronized facial animations** with speech

### 🧠 AI Integration
- **Perplexity API** for generating relevant interview questions
- **OpenAI GPT-4** for answer evaluation and final assessment
- **Graceful fallbacks** when APIs are unavailable

### 🎨 User Experience
- Responsive design with mobile support
- Real-time feedback and loading states
- Professional interview simulation flow

## 🔧 Technical Highlights

The **facial animation system** is particularly sophisticated - it maps speech synthesis events to realistic mouth movements using morph targets, with proper material updates and geometry refreshing for smooth animations.

The **error handling** is robust, with fallback mechanisms for both API failures and avatar loading issues.

## 🚀 MVP2 Vision: Enhanced Interview Platform

### 🎯 Core Enhancement Paths

#### Option A: Industry-Specific Intelligence
- **Smart Question Banks**: Pre-built question sets for different roles (SWE, Product Manager, Sales, etc.)
- **Company-Specific Prep**: Real interview questions scraped/crowdsourced from major companies
- **Technical Assessments**: Coding challenges, system design boards, case studies
- **Industry Benchmarking**: "You scored better than 73% of candidates for this role"

#### Option B: Advanced AI Coaching
- **Real-time Speech Analysis**: Pace, filler words, confidence detection
- **Body Language Feedback**: Posture, eye contact, gesture analysis via webcam
- **Personality Profiling**: STAR method coaching, communication style adaptation
- **Adaptive Difficulty**: AI adjusts question complexity based on performance

#### Option C: Social & Gamification
- **Peer Practice Network**: Match users for mock interviews with each other
- **Interview Competitions**: Leaderboards, achievement badges, streaks
- **Expert Review**: Pay for human recruiter feedback on recorded sessions
- **Study Groups**: Team preparation for specific companies/roles

### 🚀 High-Impact Features (Pick 2-3)

#### 1. Smart Recording & Analytics
```javascript
// New recording system with detailed analytics
const interviewAnalytics = {
  speechMetrics: {
    wordsPerMinute: 150,
    fillerWordCount: 12,
    pauseAnalysis: "Appropriate pacing",
    confidenceScore: 8.2
  },
  contentAnalysis: {
    starMethodUsage: "2/5 questions",
    specificityScore: 7.1,
    relevanceScore: 8.8
  },
  improvementPlan: [
    "Practice STAR method for behavioral questions",
    "Reduce filler words with pause practice"
  ]
}
```

#### 2. Multi-Modal Interview Types
- **Coding Interviews**: Integrated code editor with AI code review
- **System Design**: Interactive whiteboard with component libraries
- **Case Studies**: Business scenario simulations with data analysis
- **Presentation Mode**: Upload slides, practice pitches

#### 3. Advanced Avatar System
- **Multiple Interviewer Personas**: Friendly HR vs. Technical Lead vs. CEO personalities
- **Panel Interviews**: Multiple avatars asking different question types
- **Industry-Specific Avatars**: Startup casual vs. corporate formal
- **Emotional Intelligence**: Avatar reacts to your confidence level

#### 4. Comprehensive Progress Tracking
```python
# Enhanced backend with user profiles
class UserProgress:
    def __init__(self):
        self.skill_levels = {
            'technical': 6.2,
            'behavioral': 7.8,
            'communication': 5.9
        }
        self.interview_history = []
        self.target_companies = ['Google', 'Meta']
        self.improvement_trajectory = []
        self.next_session_recommendations = []
```

### 🎨 UI/UX Enhancements

#### Professional Dashboard
- **Performance Timeline**: Progress graphs over time
- **Skill Radar Chart**: Visual breakdown of strengths/weaknesses
- **Company Readiness Score**: "You're 78% ready for Google interviews"
- **Recommended Practice Plan**: AI-generated study schedule

#### Interview Replay System
- **Video Playback**: Review your performance with AI annotations
- **Moment-by-Moment Feedback**: Hover over timeline for specific tips
- **Side-by-Side Comparison**: Compare current vs. previous attempts
- **Shareable Highlights**: Export best answers to LinkedIn

### 💰 Monetization Features

#### Freemium Model
- **Free**: 3 interviews/month, basic feedback
- **Pro ($19/month)**: Unlimited interviews, detailed analytics, expert reviews
- **Enterprise**: Company-wide licenses for recruitment training

#### Premium Services
- **Human Expert Reviews**: $50 for detailed recruiter feedback
- **Custom Question Banks**: Companies can upload their actual questions
- **White-Label Solution**: Sell to universities/bootcamps

### 🔧 Technical Architecture Upgrades

#### Backend Improvements
```python
# Microservices architecture
services = {
    'user_service': 'User profiles, progress tracking',
    'content_service': 'Question banks, company data',
    'ai_service': 'Evaluation, coaching recommendations',
    'analytics_service': 'Performance metrics, insights',
    'notification_service': 'Practice reminders, achievements'
}
```

#### Database Design
- **User Profiles**: Detailed skill tracking, preferences, goals
- **Question Taxonomy**: Tagged by difficulty, company, role, topic
- **Performance Analytics**: Granular metrics for trend analysis
- **Content Management**: Version-controlled question banks

## 🎯 MVP2 Recommendation: "The Smart Coach"

**Focus on**: Option A + Feature 1: Industry-specific intelligence with smart analytics.

### Why this combo:
1. **Clear Value Prop**: "Practice real [Company] [Role] questions with AI coaching"
2. **Data Advantage**: Build proprietary question/answer databases
3. **Viral Potential**: "I just practiced Meta PM questions" social sharing
4. **Monetization Ready**: Premium company packs, expert reviews
5. **Technical Feasibility**: Builds on existing strengths

### 3-Month Roadmap:
- **Month 1**: Question taxonomy, basic analytics
- **Month 2**: Company-specific question packs, improved UI
- **Month 3**: Advanced coaching features, monetization

This positions the platform as the **"GitHub Copilot for interview prep"** - intelligent, specific, and indispensable for serious job seekers.

## 🛠️ Getting Started

### Prerequisites
- Python 3.8+
- Node.js (for development)
- OpenAI API Key
- Perplexity API Key

### Installation

1. **Clone the repository**
```bash
git clone [repository-url]
cd ai-mock-interview
```

2. **Install Python dependencies**
```bash
pip install flask flask-cors openai
```

3. **Set environment variables**
```bash
export OPENAI_API_KEY="your-openai-key"
export PERPLEXITY_API_KEY="your-perplexity-key"
```

4. **Run the backend**
```bash
python app.py
```

5. **Open the frontend**
```bash
# Open index.html in your browser or serve with a local server
python -m http.server 8000
```

### Usage

1. Enter your target job title and company
2. Customize voice settings and avatar preferences
3. Start the interview and answer questions via text or voice
4. Receive real-time AI feedback and coaching
5. Review your final evaluation and improvement recommendations

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

For questions or support, please open an issue in the repository or contact the development team.