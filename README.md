# AI Mock Interview - Refactored

A clean, production-ready AI-powered mock interview application with natural conversation flow, speech recognition, and AI video avatars.

## 🎯 Key Improvements

### ✅ Fixed Issues
- **Complete Flask API**: Added all missing routes and proper error handling
- **Simplified JavaScript**: Removed over-engineering, kept core functionality
- **Better Security**: Proper API key management and validation
- **Clean Architecture**: Separated concerns and removed redundancy
- **Production Ready**: Added health checks, error handlers, and configuration

### 🗑️ Removed Complexity
- Over-engineered voice activity detection
- Unnecessary defensive programming
- Redundant UI elements
- Complex conversation flow logic
- Bulletproof element access (simplified to standard JS)

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.8+
- Node.js (for modern browser features)
- Chrome/Edge browser (for speech recognition)

### 2. Environment Setup
Create a `.env` file:
```bash
OPENAI_API_KEY=your_openai_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
D_ID_API_KEY=your_did_api_key_here
```

### 3. Installation
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the Flask backend
python app.py

# Open index.html in Chrome/Edge
# Or serve with a simple HTTP server:
python -m http.server 8000
```

### 4. Usage
1. Enter job title and company (optional)
2. Click "Start Interview" 
3. Allow microphone and camera permissions
4. Speak naturally - no button clicking needed!
5. Get AI feedback and progress through questions

## 🏗️ Architecture

### Backend (`app.py`)
- **Flask API** with proper route definitions
- **Error handling** with HTTP status codes
- **Configuration management** with validation
- **D-ID integration** for video streaming
- **Health checks** for monitoring

### AI Logic (`utils.py`)
- **Question generation** via Perplexity API
- **Answer evaluation** using OpenAI GPT-4
- **Natural conversation** flow management
- **Fallback handling** when APIs fail

### Frontend (`script.js`)
- **Speech recognition** with automatic detection
- **Voice activity detection** (simplified)
- **D-ID video streaming** integration
- **Real-time transcript** display
- **Clean state management**

### UI (`index.html`)
- **Modern design** with Tailwind CSS
- **Responsive layout** (60/40 video/content split)
- **Progressive disclosure** (setup → interview → results)
- **Accessibility** improvements

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/get_questions` | POST | Generate interview questions |
| `/evaluate_answer` | POST | Evaluate candidate response |
| `/get_final_evaluation` | POST | Generate final assessment |
| `/create_did_stream` | POST | Create D-ID video stream |
| `/did_stream_sdp` | POST | Handle WebRTC SDP |
| `/did_stream_ice` | POST | Handle ICE candidates |
| `/did_stream_talk` | POST | Send text for speech synthesis |

## 🛠️ Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-...          # OpenAI API key
PERPLEXITY_API_KEY=pplx-...    # Perplexity API key  
D_ID_API_KEY=...               # D-ID API key
```

### Frontend Config (script.js)
```javascript
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:5000',
    SPEECH_TIMEOUT: 3000,
    AI_RESPONSE_DELAY: 1000,
    VAD_THRESHOLD: 0.02,
    SILENCE_FRAMES: 60
};
```

## 🐛 Troubleshooting

### Common Issues

**Microphone not working:**
- Ensure Chrome/Edge browser
- Check browser permissions
- Test with `chrome://settings/content/microphone`

**D-ID video not loading:**
- Verify D-ID API key
- Check browser console for WebRTC errors
- Ensure stable internet connection

**API errors:**
- Verify all API keys in `.env`
- Check Flask server logs
- Test endpoints with curl/Postman

**Speech recognition stops:**
- Press Ctrl+Space to manually trigger
- Check browser console for errors
- Restart the interview if needed

### Debug Commands
```bash
# Test API endpoints
curl http://localhost:5000/health

# Check Flask logs
python app.py  # See console output

# Browser debug
# Open DevTools (F12) and check Console tab
```

## 🚀 Production Deployment

### Security Checklist
- [ ] Move API keys to secure secret management
- [ ] Add rate limiting to API endpoints  
- [ ] Enable HTTPS for all connections
- [ ] Add authentication for admin features
- [ ] Configure CORS for production domains

### Scaling Considerations
- [ ] Use Redis for session storage
- [ ] Add database for interview history
- [ ] Implement load balancing
- [ ] Add monitoring and logging
- [ ] Cache AI responses to reduce API costs

## 📝 Key Features

- **Natural Conversation**: No buttons to click during interview
- **Real-time Speech**: Live transcription and voice activity detection
- **AI-Powered**: Smart question generation and evaluation
- **Video Avatar**: Realistic AI interviewer via D-ID
- **Adaptive Flow**: Questions adjust based on responses
- **Professional UI**: Clean, modern interface
- **Error Recovery**: Graceful handling of API failures

## 🎓 Usage Tips

1. **Speak clearly** and at normal pace
2. **Pause briefly** when finished answering
3. **Use specific examples** in your responses
4. **Practice different roles** to improve skills
5. **Review AI feedback** for improvement areas

## 📄 License

MIT License - feel free to modify and use for your projects!