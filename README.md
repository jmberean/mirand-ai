# 🎯 AI Mock Interview - Enhanced Edition

A realistic AI-powered mock interview application with video avatar, smart conversation flow, and intelligent follow-up questions.

## ✨ New Features

- **🔇 Audio Isolation**: Prevents AI speech from triggering user recognition
- **📱 Mobile-First Design**: Optimized for phone interviews 
- **💬 Smart Follow-ups**: AI asks relevant follow-up questions based on answer quality
- **🎭 Prominent Avatar**: 2/3 screen dedicated to lifelike AI interviewer
- **🧠 Enhanced Evaluation**: Comprehensive feedback with performance tracking
- **⚡ Better Performance**: Session management, rate limiting, error handling

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.8+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access
- Internet connection

### 2. Installation

```bash
# Clone or download the project
git clone <your-repo-url>
cd ai-mock-interview

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. API Keys Setup

1. **Copy environment template:**
   ```bash
   cp .env.template .env
   ```

2. **Get your API keys:**
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Perplexity AI**: https://www.perplexity.ai/settings/api  
   - **D-ID**: https://studio.d-id.com/account-settings

3. **Edit `.env` file:**
   ```bash
   OPENAI_API_KEY=sk-your-actual-openai-key
   PERPLEXITY_API_KEY=pplx-your-actual-perplexity-key
   D_ID_API_KEY=your-actual-d-id-key
   ```

### 4. Run the Application

```bash
# Start the backend server
python app.py

# Open your browser and go to:
# http://127.0.0.1:5000
# Then open index.html in your browser
```

## 📁 Project Structure

```
ai-mock-interview/
├── index.html          # Enhanced UI with prominent avatar
├── script.js           # Audio isolation + conversation flow
├── styles.css          # Responsive design + animations
├── app.py              # Smart backend with follow-up logic
├── utils.py            # Enhanced question generation
├── requirements.txt    # Python dependencies
├── .env.template       # Environment variables template
├── .env               # Your actual API keys (create this)
└── README.md          # This setup guide
```

## 🎮 How to Use

### For Interviewees

1. **Setup**: Enter your target job title and company
2. **Start**: Click "Start Interview" and allow microphone access
3. **Interview**: 
   - Listen to AI questions
   - Speak your answers naturally
   - Receive immediate feedback
   - Answer follow-up questions when asked
4. **Complete**: Get comprehensive final evaluation

### For Developers

1. **Test APIs**: Visit `http://127.0.0.1:5000/api_status` to check connections
2. **Monitor**: Check `http://127.0.0.1:5000/health` for system status
3. **Debug**: Use browser dev tools to monitor speech recognition and D-ID connection

## 🔧 Configuration Options

### Speech Recognition Settings

```javascript
// In script.js, adjust these variables:
let silenceThreshold = -50; // dB (lower = more sensitive)
let speechDetectionDelay = 1000; // ms delay after AI stops
```

### Conversation Flow Settings

```javascript
// Maximum follow-up questions per main question
conversationState.maxFollowUpDepth = 2;

// Timeout for auto-submitting answers (ms)
speechTimeout = 3000;
```

### Rate Limiting (Backend)

```python
# In app.py, adjust rate limits:
rate_limit_check(request.remote_addr, max_requests=20, window_minutes=1)
```

## 🐛 Troubleshooting

### Common Issues

**1. "Speech Recognition not supported"**
- Use Chrome, Firefox, or Edge browser
- Ensure HTTPS or localhost
- Check microphone permissions

**2. "D-ID not connected"**
- Verify D-ID API key in `.env`
- Check internet connection
- Try refreshing the page

**3. "Audio feedback loop"**
- This should be fixed with the enhanced audio isolation
- If it persists, check microphone settings

**4. "Questions not loading"**
- Check Perplexity API key
- Verify internet connection
- Fallback questions will be used automatically

### Debug Mode

Enable verbose logging:

```bash
# Set environment variable
export FLASK_DEBUG=True

# Or in .env file
FLASK_DEBUG=True
```

### Browser Console

Check for errors in browser dev tools:
- F12 → Console tab
- Look for red error messages
- Common issues: microphone access, API connectivity

## 📱 Mobile Usage

The app is optimized for mobile interviews:

- **Portrait Mode**: Avatar appears at top, controls below
- **Touch-Friendly**: Large buttons and controls
- **Responsive**: Adapts to different screen sizes
- **Accessible**: High contrast, clear typography

### Mobile Setup Tips

1. Use headphones to prevent echo
2. Ensure stable Wi-Fi connection
3. Keep phone plugged in for longer interviews
4. Find a quiet environment

## 🔒 Security & Privacy

- **API Keys**: Never commit `.env` file to version control
- **Audio Data**: Speech is processed locally, not stored
- **Session Data**: Cleared automatically after 2 hours
- **Rate Limiting**: Prevents API abuse

## 🚢 Deployment

### Local Production

```bash
# Use production WSGI server
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Environment Variables for Production

```bash
FLASK_ENV=production
FLASK_DEBUG=False
# Add your production API keys
```

### HTTPS Setup (Required for speech recognition)

For production deployment, ensure HTTPS is configured as browsers require secure context for microphone access.

## 📊 API Endpoints

### Interview Endpoints
- `POST /get_questions` - Generate role-specific questions
- `POST /evaluate_answer` - Evaluate answer with follow-up logic
- `POST /get_final_evaluation` - Comprehensive final assessment

### D-ID Proxy Endpoints
- `POST /create_did_stream` - Initialize video avatar
- `POST /did_stream_talk` - Send text for avatar to speak
- `POST /did_stream_destroy` - Clean up video session

### Utility Endpoints
- `GET /health` - System health check
- `GET /api_status` - Check API connectivity
- `POST /start_session` - Initialize new interview session

## 🎯 Performance Tips

1. **Stable Internet**: Video streaming requires good bandwidth
2. **Modern Browser**: Latest Chrome/Firefox for best performance  
3. **Quiet Environment**: Reduces speech recognition errors
4. **Good Microphone**: Clear audio improves transcription accuracy

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Test your changes thoroughly
4. Submit pull request with detailed description

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:

1. Check this README for troubleshooting steps
2. Verify all API keys are correctly set
3. Test individual components (speech recognition, D-ID connection)
4. Check browser console for error messages

## 🎉 Changelog

### Version 2.0.0 (Enhanced Edition)
- ✅ Audio isolation system prevents feedback loops
- ✅ Smart follow-up questions based on answer quality
- ✅ Mobile-first responsive design
- ✅ Prominent avatar display (2/3 screen width)
- ✅ Enhanced session management with automatic cleanup
- ✅ Rate limiting and security improvements
- ✅ Comprehensive error handling and fallbacks
- ✅ Natural conversation flow with smooth transitions
- ✅ Real-time speech status indicators
- ✅ Accessibility improvements (WCAG 2.1 AA)

### Version 1.0.0 (Original)
- ✅ Basic D-ID video avatar integration
- ✅ Speech recognition for voice input
- ✅ OpenAI answer evaluation
- ✅ Perplexity question generation

---

**Ready to ace your next interview?** 🚀 Follow the setup guide above and start practicing!