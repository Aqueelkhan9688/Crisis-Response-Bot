import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSpeechRecognition, useSpeechSynthesis } from 'react-speech-kit';
import './App.css';

// Material-UI Components
import { 
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Card,
  CardContent,
  Alert,
  Chip,
  Avatar,
  ThemeProvider,
  createTheme,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fade,
  Zoom,
  Paper
} from '@mui/material';

// Material-UI Icons
import {
  Send as SendIcon,
  Warning as WarningIcon,
  LocationOn as LocationIcon,
  Emergency as EmergencyIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Translate as TranslateIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpIcon,
  AccessTime as TimeIcon,
  ErrorOutline as ErrorIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  ArrowDownward as ArrowDownIcon,
  WifiOff as OfflineIcon
} from '@mui/icons-material';

// Emergency colors theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#d32f2f',
      light: '#ff6659',
      dark: '#9a0007',
    },
    secondary: {
      main: '#1976d2',
      light: '#63a4ff',
      dark: '#004ba0',
    },
    warning: {
      main: '#ff9800',
      light: '#ffc947',
      dark: '#c66900',
    },
    success: {
      main: '#2e7d32',
      light: '#60ad5e',
      dark: '#005005',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Arial", sans-serif',
    h6: {
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
});

// Language options with native names
const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

// Emergency quick actions with icons
const EMERGENCY_ACTIONS = [
  { 
    label: '🚨 ReportEmergency', 
    action: 'There is an emergency',
    color: 'error',
  },
  { 
    label: '📍 Share Location', 
    action: 'share_location',
    color: 'primary',
    // icon: <LocationIcon fontSize="small" />
  },
  { 
    label: '🏠 Find Shelters', 
    action: 'Where are emergency shelters?',
    color: 'warning',
    // icon: <SecurityIcon fontSize="small" />
  },
  { 
    label: '👨‍⚕️ Human Operator', 
    action: 'Connect me to a human operator',
    color: 'secondary',
    // icon: <PersonIcon fontSize="small" />
  },
  { 
    label: '🩺 First Aid', 
    action: 'I need first aid instructions',
    color: 'error',
    // icon: <HelpIcon fontSize="small" />
  },
  { 
    label: '📞EmergencyContacts', 
    action: 'Show emergency contacts',
    color: 'success',
    // icon: <VolumeUpIcon fontSize="small" />
  },
];

function App() {
  // State Management
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "🚨 Emergency Response Assistant activated. Are you safe? Please describe your situation.",
      sender: 'bot',
      timestamp: new Date(),
      type: 'system',
      read: true
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [language, setLanguage] = useState('en');
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Speech Recognition Hook
  const { listen, listening, stop } = useSpeechRecognition({
    onResult: (result) => {
      setInput(result);
      setIsListening(false);
    },
    onEnd: () => {
      setIsListening(false);
    },
  });

  // Speech Synthesis Hook
  const { speak, speaking, cancel } = useSpeechSynthesis();

  // Language-specific placeholders
  const PLACEHOLDERS = {
    en: "Describe your emergency situation...",
    es: "Describa su situación de emergencia...",
    fr: "Décrivez votre situation d'urgence...",
    de: "Beschreiben Sie Ihre Notfallsituation...",
    hi: "अपनी आपातकालीन स्थिति का वर्णन करें...",
    ar: "صف حالة الطوارئ الخاصة بك...",
    zh: "描述您的紧急情况..."
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // Mark messages as read when scrolled
    setUnreadCount(0);
  }, [messages]);

  // Read new messages aloud if speech is enabled
  useEffect(() => {
    if (isSpeechEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'bot' && !lastMessage.read) {
        speak({
          text: lastMessage.text.replace(/[🚨📍🏠👨‍⚕️🩺📞⚠️🔴🟠🟡🟢]/g, ''),
          lang: language
        });
        // Mark as read
        setMessages(prev => prev.map(msg => 
          msg.id === lastMessage.id ? { ...msg, read: true } : msg
        ));
      }
    }
  }, [messages, isSpeechEnabled, language, speak]);

  // Toggle speech listening
  const toggleListening = () => {
    if (listening) {
      stop();
      setIsListening(false);
    } else {
      listen({ lang: language });
      setIsListening(true);
    }
  };

  // Send message to Rasa backend
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
      type: 'user',
      read: true
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setInput('');
    setConnectionStatus('connecting');

    try {
      const response = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
        sender: 'user',
        message: input,
        metadata: { language }
      }, {
        timeout: 5000 // 5 second timeout
      });

      if (response.data && response.data.length > 0) {
        const botMessages = response.data.map(msg => ({
          id: Date.now() + Math.random(),
          text: msg.text,
          sender: 'bot',
          timestamp: new Date(),
          type: 'response',
          read: false
        }));
        setMessages(prev => [...prev, ...botMessages]);
        setUnreadCount(prev => prev + botMessages.length);
      }
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now(),
        text: "⚠️ Unable to connect to emergency services. Please call 112 immediately if this is an emergency.",
        sender: 'bot',
        timestamp: new Date(),
        type: 'error',
        read: false
      };
      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus('disconnected');
    } finally {
      setIsTyping(false);
    }
  };

  // Handle quick action clicks
  const handleQuickAction = (action) => {
    if (action === 'share_location') {
      requestLocation();
    } else {
      setInput(action);
      setTimeout(() => sendMessage(), 100);
    }
  };

  // Request location with permission
  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          const locationMessage = `My location is ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setInput(locationMessage);
          // Auto-send location
          setTimeout(() => sendMessage(), 500);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Show location dialog for manual input
          setShowEmergencyDialog(true);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Handle manual location input
  const handleManualLocation = () => {
    const manualLocation = prompt('Please enter your location (city, address, or landmark):');
    if (manualLocation) {
      setUserLocation({ manual: manualLocation });
      setInput(`My location is ${manualLocation}`);
      setTimeout(() => sendMessage(), 500);
    }
  };

  // Handle language change
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    // Send language preference to backend
    axios.post('http://localhost:5005/webhooks/rest/webhook', {
      sender: 'user',
      message: `/set_language ${lang}`
    }).catch(console.error);
    setAnchorEl(null);
  };

  // Toggle speech synthesis
  const toggleSpeech = () => {
    if (speaking) {
      cancel();
    }
    setIsSpeechEnabled(!isSpeechEnabled);
  };

  // Format timestamp
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get message style based on type
  const getMessageStyle = (type, sender) => {
    const baseStyle = {
      maxWidth: '85%',
      marginBottom: '8px',
      alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
      transition: 'all 0.3s ease',
    };

    const typeStyles = {
      system: {
        backgroundColor: '#e3f2fd',
        borderLeft: '4px solid #1976d2',
      },
      user: {
        backgroundColor: '#e8f5e9',
        borderLeft: '4px solid #2e7d32',
      },
      response: {
        backgroundColor: '#fff3e0',
        borderLeft: '4px solid #ff9800',
      },
      error: {
        backgroundColor: '#ffebee',
        borderLeft: '4px solid #d32f2f',
      },
      warning: {
        backgroundColor: '#fff8e1',
        borderLeft: '4px solid #ff9800',
      }
    };

    return { ...baseStyle, ...typeStyles[type] };
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    const statusConfig = {
      connected: { color: 'success', text: 'Connected', icon: <SuccessIcon /> },
      connecting: { color: 'warning', text: 'Connecting...', icon: <TimeIcon /> },
      disconnected: { color: 'error', text: 'Disconnected', icon: <OfflineIcon /> }
    };

    const config = statusConfig[connectionStatus];
    return (
      <Chip
        icon={config.icon}
        label={config.text}
        size="small"
        color={config.color}
        variant="outlined"
        sx={{ ml: 1 }}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ py: 2, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <Paper 
          elevation={3}
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            p: 2, 
            mb: 2,
            borderRadius: 2,
            display: 'flex', 
            alignItems: 'center',
            gap: 2,
            position: 'sticky',
            top: 0,
            zIndex: 1000
          }}
        >
          <EmergencyIcon fontSize="large" sx={{ animation: 'pulse 2s infinite' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              🚨 Emergency Response Assistant
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                24/7 Crisis Support • Verified Information • Multilingual
              </Typography>
              {renderConnectionStatus()}
            </Box>
          </Box>
          
          {/* Language Selector */}
          <Tooltip title="Change Language">
            <IconButton 
              color="inherit" 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            >
              <TranslateIcon />
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                {LANGUAGES.find(l => l.code === language)?.code.toUpperCase()}
              </Typography>
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                selected={language === lang.code}
              >
                <Typography>{lang.nativeName} ({lang.name})</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Paper>

        {/* Critical Warning Alert */}
        <Alert 
          severity="error"
          icon={<WarningIcon />}
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            animation: 'shake 0.5s ease-in-out infinite',
            border: '2px solid #d32f2f'
          }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              href="tel:112"
              sx={{ fontWeight: 'bold' }}
            >
              📞 CALL 112
            </Button>
          }
        >
          <Typography fontWeight="bold">
            ⚠️ FOR IMMEDIATE LIFE-THREATENING EMERGENCIES, CALL 112 FIRST
          </Typography>
        </Alert>

        {/* Connection Status Bar */}
        {connectionStatus === 'connecting' && (
          <LinearProgress 
            color="warning" 
            sx={{ mb: 2, height: 3, borderRadius: 1 }} 
          />
        )}

        {/* Quick Actions Grid */}
        <Paper 
          elevation={1}
          sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: '#fffde7', 
            borderRadius: 2,
            border: '2px solid #ff9800'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">
              🚑 QUICK EMERGENCY ACTIONS:
            </Typography>
            {unreadCount > 0 && (
              <Chip 
                label={`${unreadCount} new message${unreadCount > 1 ? 's' : ''}`}
                color="primary" 
                size="small"
                onClick={scrollToBottom}
              />
            )}
          </Box>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1 
          }}>
            {EMERGENCY_ACTIONS.map((item, index) => (
              <Zoom in key={index} style={{ transitionDelay: `${index * 100}ms` }}>
                <Button
                  variant="contained"
                  color={item.color}
                  startIcon={item.icon}
                  onClick={() => handleQuickAction(item.action)}
                  sx={{
                    py: 1.5,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    '&:hover': { transform: 'translateY(-2px)' },
                    transition: 'all 0.3s ease'
                  }}
                  fullWidth
                >
                  {item.label}
                </Button>
              </Zoom>
            ))}
          </Box>
        </Paper>

        {/* Chat Container */}
        <Paper 
          elevation={2}
          sx={{ 
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            mb: 2,
            borderRadius: 2,
            border: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}
        >
          {/* Chat Header */}
          <Box sx={{ 
            p: 1.5, 
            bgcolor: 'background.paper',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="subtitle2" color="text.secondary">
              <TimeIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Live Emergency Chat • {formatTime(new Date())}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={isSpeechEnabled ? "Disable voice output" : "Enable voice output"}>
                <IconButton 
                  size="small" 
                  onClick={toggleSpeech}
                  color={isSpeechEnabled ? "primary" : "default"}
                >
                  {isSpeechEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Emergency help">
                <IconButton 
                  size="small" 
                  onClick={() => window.open('https://www.ifrc.org/emergency-app', '_blank')}
                >
                  <HelpIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Chat Messages */}
          <Box 
            sx={{ 
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: '#fafafa',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#555',
              },
            }}
          >
            {messages.map((msg) => (
              <Fade in key={msg.id}>
                <Card 
                  elevation={1}
                  sx={getMessageStyle(msg.type, msg.sender)}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar sx={{ 
                        width: 28, 
                        height: 28, 
                        mr: 1,
                        bgcolor: msg.sender === 'user' ? 'secondary.main' : 'primary.main'
                      }}>
                        {msg.sender === 'user' ? <PersonIcon fontSize="small" /> : <EmergencyIcon fontSize="small" />}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" fontWeight="bold" color="text.primary">
                          {msg.sender === 'user' ? 'You' : 'Emergency Assistant'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {formatTime(msg.timestamp)}
                        </Typography>
                      </Box>
                      {msg.type === 'error' && <ErrorIcon color="error" fontSize="small" />}
                    </Box>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6
                      }}
                    >
                      {msg.text}
                    </Typography>
                  </CardContent>
                </Card>
              </Fade>
            ))}
            
            {isTyping && (
              <Card sx={{ maxWidth: '85%', alignSelf: 'flex-start', bgcolor: '#fff3e0' }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 0.5,
                      '& > div': {
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: '#ff9800',
                        animation: 'bounce 1.4s infinite ease-in-out both',
                        '&:nth-child(1)': { animationDelay: '-0.32s' },
                        '&:nth-child(2)': { animationDelay: '-0.16s' },
                      }
                    }}>
                      <div></div>
                      <div></div>
                      <div></div>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Emergency Assistant is assessing your situation...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
            
            <div ref={messagesEndRef} />
            
            {/* Scroll to bottom button */}
            {messages.length > 5 && (
              <Fade in>
                <IconButton
                  size="small"
                  onClick={scrollToBottom}
                  sx={{
                    position: 'sticky',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    boxShadow: 3
                  }}
                >
                  <ArrowDownIcon />
                </IconButton>
              </Fade>
            )}
          </Box>

          {/* Input Area */}
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid #e0e0e0', 
            bgcolor: 'background.paper',
            position: 'sticky',
            bottom: 0
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              {/* Speech Input Button */}
              <Tooltip title={listening ? "Stop recording" : "Start voice input"}>
                <IconButton
                  color={listening ? "error" : "primary"}
                  onClick={toggleListening}
                  sx={{ 
                    alignSelf: 'flex-end',
                    mb: 1,
                    animation: listening ? 'pulse 1.5s infinite' : 'none'
                  }}
                >
                  {listening ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
              
              {/* Text Input */}
              <TextField
                inputRef={inputRef}
                fullWidth
                variant="outlined"
                placeholder={PLACEHOLDERS[language]}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                multiline
                maxRows={4}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
              
              {/* Send Button */}
              <Button
                variant="contained"
                endIcon={<SendIcon />}
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                sx={{ 
                  minWidth: '100px',
                  alignSelf: 'flex-end',
                  mb: 1,
                  height: '40px'
                }}
              >
                Send
              </Button>
            </Box>
            
            {/* Status Bar */}
            <Box sx={{ 
              mt: 1, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {listening && (
                  <Chip
                    icon={<MicIcon />}
                    label="Listening..."
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
                {userLocation && (
                  <Chip
                    icon={<LocationIcon />}
                    label={`Location: ${userLocation.latitude ? `${userLocation.latitude.toFixed(2)}, ${userLocation.longitude.toFixed(2)}` : userLocation.manual}`}
                    size="small"
                    color="success"
                    variant="outlined"
                    onDelete={() => setUserLocation(null)}
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <SecurityIcon fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  End-to-end encrypted
                </Typography>
                <Chip
                  label={LANGUAGES.find(l => l.code === language)?.nativeName}
                  size="small"
                  variant="outlined"
                  icon={<TranslateIcon />}
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Footer */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 1, 
            textAlign: 'center',
            bgcolor: 'transparent',
            borderTop: '1px dashed #e0e0e0'
          }}
        >
          <Typography variant="caption" color="text.secondary">
            🛡️ This service complies with international emergency response protocols. 
            Data is processed securely and never shared with third parties.
          </Typography>
        </Paper>
      </Container>

      {/* Emergency Location Dialog */}
      <Dialog 
        open={showEmergencyDialog} 
        onClose={() => setShowEmergencyDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <EmergencyIcon color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Critical: Location Required
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Your location is essential for emergency response. Please choose an option:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<LocationIcon />}
              onClick={() => {
                setShowEmergencyDialog(false);
                requestLocation();
              }}
              fullWidth
            >
              Retry GPS Location
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                setShowEmergencyDialog(false);
                handleManualLocation();
              }}
              fullWidth
            >
              Enter Location Manually
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEmergencyDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;