import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wind,
  Zap,
  HelpCircle,
  Anchor,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import { RiskExplanation, RiskFactor, RiskDecision } from '../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface RiskExplanationCardProps {
  explanation?: RiskExplanation;
  language?: string;
}

interface CardStrings {
  riskIndex: string;
  primaryThingToWatch: string;
  primarySafetyConcern: string;
  primaryHazardToMonitor: string;
  whyThisDecision: string;
  evaluatedAgainstLimits: string;
  safe: string;
  caution: string;
  danger: string;
  noData: string;
  recommendedAction: string;
  whatShouldYouDo: string;
  dataNotice: string;
  defaultGo: string;
  defaultCaution: string;
  defaultDontGo: string;
  factorNames: Record<string, string>;
}

const LOCALIZED_LABELS: Record<string, CardStrings> = {
  en: {
    riskIndex: 'Risk Index',
    primaryThingToWatch: 'PRIMARY THING TO WATCH',
    primarySafetyConcern: 'PRIMARY SAFETY CONCERN',
    primaryHazardToMonitor: 'PRIMARY HAZARD TO MONITOR',
    whyThisDecision: 'WHY THIS DECISION?',
    evaluatedAgainstLimits: 'Key environmental factors evaluated against boat safety limits:',
    safe: 'SAFE',
    caution: 'CAUTION',
    danger: 'DANGER',
    noData: 'NO DATA',
    recommendedAction: 'RECOMMENDED ACTION',
    whatShouldYouDo: 'What Should You Do?',
    dataNotice: 'Notice: Some real-time ocean data feeds were offline and could not be evaluated. Always exercise caution at sea.',
    defaultGo: 'GO – Marine Conditions Safe',
    defaultCaution: 'CAUTION – Marginal Conditions',
    defaultDontGo: "DON'T GO – Hazardous Conditions",
    factorNames: {},
  },
  mr: {
    riskIndex: 'जोखीम निर्देशांक',
    primaryThingToWatch: 'पाहण्याची मुख्य गोष्ट',
    primarySafetyConcern: 'प्राथमिक सुरक्षा चिंता',
    primaryHazardToMonitor: 'निरीक्षणासाठी मुख्य धोका',
    whyThisDecision: 'हा निर्णय का?',
    evaluatedAgainstLimits: 'बोटीच्या सुरक्षा मर्यादेनुसार मूल्यमापन केलेले मुख्य पर्यावरणीय घटक:',
    safe: 'सुरक्षित',
    caution: 'सावधान',
    danger: 'धोका',
    noData: 'माहिती उपलब्ध नाही',
    recommendedAction: 'शिफारस केलेली कृती',
    whatShouldYouDo: 'तुम्ही काय करावे?',
    dataNotice: 'सूचना: काही रिअल-टाइम सागरी डेटा फीड्स ऑफलाइन होते आणि त्यांचे मूल्यांकन केले जाऊ शकले नाही. समुद्रात नेहमी काळजी घ्या.',
    defaultGo: 'GO – सागरी परिस्थिती सुरक्षित',
    defaultCaution: 'CAUTION – मध्यम परिस्थिती',
    defaultDontGo: "DON'T GO – धोकादायक परिस्थिती",
    factorNames: {
      'Wave Height': 'लाटांची उंची',
      'Wind Speed': 'वाऱ्याचा वेग',
      'Wind Gusts': 'वाऱ्याची झुळूक',
      'Ocean Current': 'सागरी प्रवाह',
      'Thunderstorm & Lightning': 'वादळ आणि विजांचा कडकडाट',
      'Official INCOIS SVAS Advisory': 'अधिकृत INCOIS SVAS सल्लागार',
      'Marine Hazards': 'सागरी धोके',
    },
  },
  hi: {
    riskIndex: 'जोखिम सूचकांक',
    primaryThingToWatch: 'निगरानी योग्य मुख्य बात',
    primarySafetyConcern: 'प्राथमिक सुरक्षा चिंता',
    primaryHazardToMonitor: 'निगरानी योग्य मुख्य खतरा',
    whyThisDecision: 'यह निर्णय क्यों?',
    evaluatedAgainstLimits: 'नाव की सुरक्षा सीमाओं के विरुद्ध मूल्यांकित प्रमुख पर्यावरणीय कारक:',
    safe: 'सुरक्षित',
    caution: 'सावधानी',
    danger: 'खतरा',
    noData: 'डेटा उपलब्ध नहीं',
    recommendedAction: 'अनुशंसित कार्रवाई',
    whatShouldYouDo: 'आपको क्या करना चाहिए?',
    dataNotice: 'सूचना: कुछ वास्तविक समय के महासागरीय डेटा फ़ीड ऑफ़लाइन थे और उनका मूल्यांकन नहीं किया जा सका। समुद्र में हमेशा सावधानी बरतें।',
    defaultGo: 'GO – समुद्री स्थितियां सुरक्षित',
    defaultCaution: 'CAUTION – सामान्य स्थितियां',
    defaultDontGo: "DON'T GO – खतरनाक स्थितियां",
    factorNames: {
      'Wave Height': 'लहरों की ऊंचाई',
      'Wind Speed': 'हवा की गति',
      'Wind Gusts': 'हवा के झोंके',
      'Ocean Current': 'समुद्री धारा',
      'Thunderstorm & Lightning': 'आंधी और बिजली',
      'Official INCOIS SVAS Advisory': 'आधिकारिक INCOIS SVAS परामर्श',
      'Marine Hazards': 'समुद्री खतरे',
    },
  },
  ta: {
    riskIndex: 'ஆபத்து குறியீடு',
    primaryThingToWatch: 'கவனிக்க வேண்டிய முதன்மை விஷயம்',
    primarySafetyConcern: 'முதன்மை பாதுகாப்பு கவலை',
    primaryHazardToMonitor: 'கண்காணிக்க வேண்டிய முதன்மை ஆபத்து',
    whyThisDecision: 'இந்த முடிவு ஏன்?',
    evaluatedAgainstLimits: 'படகு பாதுகாப்பு வரம்புகளுக்கு எதிராக மதிப்பீடு செய்யப்பட்ட சுற்றுச்சூழல் காரணிகள்:',
    safe: 'பாதுகாப்பானது',
    caution: 'எச்சரிக்கை',
    danger: 'ஆபத்து',
    noData: 'தரவு இல்லை',
    recommendedAction: 'பரிந்துரைக்கப்பட்ட நடவடிக்கை',
    whatShouldYouDo: 'நீங்கள் என்ன செய்ய வேண்டும்?',
    dataNotice: 'அறிவிப்பு: சில நிகழ்நேர கடல் தரவு இணைப்புகள் ஆஃப்லைனில் இருந்தன. கடலில் எப்போதும் எச்சரிக்கையுடன் இருங்கள்.',
    defaultGo: 'GO – கடல் நிலைமைகள் பாதுகாப்பானவை',
    defaultCaution: 'CAUTION – மிதமான நிலைமைகள்',
    defaultDontGo: "DON'T GO – ஆபத்தான நிலைமைகள்",
    factorNames: {
      'Wave Height': 'அலை உயரம்',
      'Wind Speed': 'காற்றின் வேகம்',
      'Wind Gusts': 'காற்று வீச்சு',
      'Ocean Current': 'கடல் நீரோட்டம்',
      'Thunderstorm & Lightning': 'இடி மின்னல்',
      'Official INCOIS SVAS Advisory': 'அதிகாரப்பூர்வ INCOIS SVAS ஆலோசனை',
      'Marine Hazards': 'கடல் ஆபத்துகள்',
    },
  },
  te: {
    riskIndex: 'రిస్క్ సూచిక',
    primaryThingToWatch: 'గమనించవలసిన ప్రాధమిక అంశం',
    primarySafetyConcern: 'ప్రాథమిక భద్రతా ఆందోళన',
    primaryHazardToMonitor: 'పర్యవేక్షించవలసిన ప్రధాన ప్రమాదం',
    whyThisDecision: 'ఈ నిర్ణయం ఎందుకు?',
    evaluatedAgainstLimits: 'బోటు భద్రతా పరిమితులకు వ్యతిరేకంగా మూల్యాంకనం చేయబడిన పర్యావరణ కారకాలు:',
    safe: 'సురక్షితం',
    caution: 'హెచ్చరిక',
    danger: 'ప్రమాదం',
    noData: 'డేటా అందుబాటులో లేదు',
    recommendedAction: 'సిఫార్సు చేసిన చర్య',
    whatShouldYouDo: 'మీరు ఏమి చేయాలి?',
    dataNotice: 'గమనిక: కొన్ని రియల్-టైమ్ సముద్ర డేటా ఫీడ్‌లు ఆఫ్‌లైన్‌లో ఉన్నాయి. సముద్రంలో ఎల్లప్పుడూ జాగ్రత్త వహించండి.',
    defaultGo: 'GO – సముద్ర పరిస్థితులు సురక్షితం',
    defaultCaution: 'CAUTION – మధ్యస్థ పరిస్థితులు',
    defaultDontGo: "DON'T GO – ప్రమాదకర పరిస్థితులు",
    factorNames: {
      'Wave Height': 'అలల ఎత్తు',
      'Wind Speed': 'గాలి వేగం',
      'Wind Gusts': 'గాలి ఉధృతి',
      'Ocean Current': 'సముద్ర ప్రవాహం',
      'Thunderstorm & Lightning': 'ఉరుములు మరియు మెరుపులు',
      'Official INCOIS SVAS Advisory': 'అధికారిక INCOIS SVAS సలహా',
      'Marine Hazards': 'సముద్ర ప్రమాదాలు',
    },
  },
  gu: {
    riskIndex: 'જોખમ સૂચકાંક',
    primaryThingToWatch: 'ધ્યાન રાખવા જેવી મુખ્ય બાબત',
    primarySafetyConcern: 'પ્રાથમિક સુરક્ષા ચિંતા',
    primaryHazardToMonitor: 'નિરીક્ષણ કરવા યોગ્ય મુખ્ય જોખમ',
    whyThisDecision: 'આ નિર્ણય શા માટે?',
    evaluatedAgainstLimits: 'હોડીની સુરક્ષા મર્યાદા સામે મૂલ્યાંકન કરાયેલા મુખ્ય પર્યાવરણીય પરિબળો:',
    safe: 'સુરક્ષિત',
    caution: 'સાવચેતી',
    danger: 'જોખમ',
    noData: 'ડેટા ઉપલબ્ધ નથી',
    recommendedAction: 'ભલામણ કરેલ પગલાં',
    whatShouldYouDo: 'તમારે શું કરવું જોઈએ?',
    dataNotice: 'સૂચના: કેટલાક રીઅલ-ટાઇમ સમુદ્રી ડેટા ફીડ ઑફલાઇન હતા. સમુદ્રમાં હંમેશા સાવચેતી રાખો.',
    defaultGo: 'GO – સમુદ્રી પરિસ્થિતિ સુરક્ષિત',
    defaultCaution: 'CAUTION – સાધારણ પરિસ્થિતિ',
    defaultDontGo: "DON'T GO – જોખમી પરિસ્થિતિ",
    factorNames: {
      'Wave Height': 'મોજાની ઊંચાઈ',
      'Wind Speed': 'પવનની ગતિ',
      'Wind Gusts': 'પવનના ઝાપટા',
      'Ocean Current': 'સમુદ્રી પ્રવાહ',
      'Thunderstorm & Lightning': 'વાવાઝોડું અને વીજળી',
      'Official INCOIS SVAS Advisory': 'સત્તાવાર INCOIS SVAS સલાહ',
      'Marine Hazards': 'દરિયાઈ જોખમો',
    },
  },
  kn: {
    riskIndex: 'ಅಪಾಯ ಸೂಚ್ಯಂಕ',
    primaryThingToWatch: 'ಗಮನಿಸಬೇಕಾದ ಮುಖ್ಯ ಅಂಶ',
    primarySafetyConcern: 'ಪ್ರಾಥಮಿಕ ಸುರಕ್ಷತಾ ಕಾಳಜಿ',
    primaryHazardToMonitor: 'ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಬೇಕಾದ ಪ್ರಮುಖ ಅಪಾಯ',
    whyThisDecision: 'ಈ ನಿರ್ಧಾರ ಏಕೆ?',
    evaluatedAgainstLimits: 'ದೋಣಿ ಸುರಕ್ಷತಾ ಮಿತಿಗಳಿಗೆ ಅನುಗುಣವಾಗಿ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾದ ಪರಿಸರ ಅಂಶಗಳು:',
    safe: 'ಸುರಕ್ಷಿತ',
    caution: 'ಎಚ್ಚರಿಕೆ',
    danger: 'ಅಪಾಯ',
    noData: 'ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ',
    recommendedAction: 'ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮ',
    whatShouldYouDo: 'ನೀವು ಏನು ಮಾಡಬೇಕು?',
    dataNotice: 'ಸೂಚನೆ: ಕೆಲವು ನೈಜ-ಸಮಯದ ಸಮುದ್ರ ದತ್ತಾಂಶ ಫೀಡ್‌ಗಳು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದವು. ಸಮುದ್ರದಲ್ಲಿ ಯಾವಾಗಲೂ ಎಚ್ಚರಿಕೆ ವಹಿಸಿ.',
    defaultGo: 'GO – ಸಮುದ್ರ ಪರಿಸ್ಥಿತಿ ಸುರಕ್ಷಿತ',
    defaultCaution: 'CAUTION – ಮಧ್ಯಮ ಪರಿಸ್ಥಿತಿ',
    defaultDontGo: "DON'T GO – ಅಪಾಯಕಾರಿ ಪರಿಸ್ಥಿತಿ",
    factorNames: {
      'Wave Height': 'ಅಲೆಗಳ ಎತ್ತರ',
      'Wind Speed': 'ಗಾಳಿಯ ವೇಗ',
      'Wind Gusts': 'ಗಾಳಿಯ ರಭಸ',
      'Ocean Current': 'ಸಾಗರ ಪ್ರವಾಹ',
      'Thunderstorm & Lightning': 'ಗುಡುಗು ಮತ್ತು ಮಿಂಚು',
      'Official INCOIS SVAS Advisory': 'ಅಧಿಕೃತ INCOIS SVAS ಸಲಹೆ',
      'Marine Hazards': 'ಸಾಗರ ಅಪಾಯಗಳು',
    },
  },
  ml: {
    riskIndex: 'അപകടസാധ്യതാ സൂചിക',
    primaryThingToWatch: 'ശ്രദ്ധിക്കേണ്ട പ്രധാന കാര്യം',
    primarySafetyConcern: 'പ്രാഥമിക സുരക്ഷാ ആശങ്ക',
    primaryHazardToMonitor: 'നിരീക്ഷിക്കേണ്ട പ്രധാന അപകടം',
    whyThisDecision: 'എന്തുകൊണ്ട് ഈ തീരുമാനം?',
    evaluatedAgainstLimits: 'ബോട്ടിന്റെ സുരക്ഷാ പരിധികൾക്കനുസൃതമായി വിലയിരുത്തിയ ഘടകങ്ങൾ:',
    safe: 'സുരക്ഷിതം',
    caution: 'ജാഗ്രത',
    danger: 'അപകടം',
    noData: 'വിവരം ലഭ്യമല്ല',
    recommendedAction: 'ശുപാർശ ചെയ്യുന്ന നടപടി',
    whatShouldYouDo: 'നിങ്ങൾ എന്ത് ചെയ്യണം?',
    dataNotice: 'അറിയിപ്പ്: ചില സമുദ്ര വിവരങ്ങൾ ലഭ്യമായിരുന്നില്ല. കടലിൽ എപ്പോഴും ജാഗ്രത പാലിക്കുക.',
    defaultGo: 'GO – കടൽ സ്ഥിതി സുരക്ഷിതമാണ്',
    defaultCaution: 'CAUTION – ജാഗ്രത പാലിക്കുക',
    defaultDontGo: "DON'T GO – അപകടകരമായ സാഹചര്യം",
    factorNames: {
      'Wave Height': 'തിരമാല ഉയരം',
      'Wind Speed': 'കാറ്റിന്റെ വേഗത',
      'Wind Gusts': 'കാറ്റടിച്ചിൽ',
      'Ocean Current': 'സമുദ്ര പ്രവാഹം',
      'Thunderstorm & Lightning': 'ഇടിമിന്നൽ',
      'Official INCOIS SVAS Advisory': 'ഔദ്യോഗിക INCOIS SVAS മുന്നറിയിപ്പ്',
      'Marine Hazards': 'സമുദ്ര അപകടങ്ങൾ',
    },
  },
  bn: {
    riskIndex: 'ঝুঁকি সূচক',
    primaryThingToWatch: 'লক্ষ্য করার প্রধান বিষয়',
    primarySafetyConcern: 'প্রাথমিক নিরাপত্তা উদ্বেগ',
    primaryHazardToMonitor: 'নজরদারির প্রধান বিপদ',
    whyThisDecision: 'কেন এই সিদ্ধান্ত?',
    evaluatedAgainstLimits: 'নৌকার সুরক্ষা সীমার বিপরীতে মূল্যায়ন করা পরিবেশগত কারণসমূহ:',
    safe: 'নিরাপদ',
    caution: 'সতর্কতা',
    danger: 'বিপদ',
    noData: 'তথ্য অনুপলব্ধ',
    recommendedAction: 'সুপারিশকৃত পদক্ষেপ',
    whatShouldYouDo: 'আপনার কি করা উচিত?',
    dataNotice: 'বিজ্ঞপ্তি: কিছু রিয়েল-টাইম সমুদ্রের তথ্য অফলাইনে ছিল। সমুদ্রে সর্বদা সতর্কতা অবলম্বন করুন।',
    defaultGo: 'GO – সমুদ্রের অবস্থা নিরাপদ',
    defaultCaution: 'CAUTION – মাঝারি পরিস্থিতি',
    defaultDontGo: "DON'T GO – বিপজ্জনক পরিস্থিতি",
    factorNames: {
      'Wave Height': 'ঢেউয়ের উচ্চতা',
      'Wind Speed': 'বাতাসের গতিবেগ',
      'Wind Gusts': 'দমকা হাওয়া',
      'Ocean Current': 'সমুদ্রের স্রোত',
      'Thunderstorm & Lightning': 'ঝড় ও বজ্রপাত',
      'Official INCOIS SVAS Advisory': 'অফিসিয়াল INCOIS SVAS পরামর্শ',
      'Marine Hazards': 'সামুদ্রিক বিপদ',
    },
  },
  or: {
    riskIndex: 'ବିପଦ ସୂଚକାଙ୍କ',
    primaryThingToWatch: 'ଦୃଷ୍ଟି ଦେବାକୁ ଥିବା ମୁଖ୍ୟ ବିଷୟ',
    primarySafetyConcern: 'ପ୍ରାଥମିକ ସୁରକ୍ଷା ଚିନ୍ତା',
    primaryHazardToMonitor: 'ନିରୀକ୍ଷଣ ପାଇଁ ମୁଖ୍ୟ ବିପଦ',
    whyThisDecision: 'ଏହି ନିଷ୍ପତ୍ତି କାହିଁକି?',
    evaluatedAgainstLimits: 'ଡଙ୍ଗା ସୁରକ୍ଷା ସୀମା ବିରୁଦ୍ଧରେ ମୂଲ୍ୟାଙ୍କନ କରାଯାଇଥିବା ପରିବେଶ କାରକ:',
    safe: 'ସୁରକ୍ଷିତ',
    caution: 'ସାବଧାନତା',
    danger: 'ବିପଦ',
    noData: 'ତଥ୍ୟ ଉପଲବ୍ଧ ନାହିଁ',
    recommendedAction: 'ପରାମର୍ଶିତ କାର୍ଯ୍ୟାନୁଷ୍ଠାନ',
    whatShouldYouDo: 'ଆପଣ କ’ଣ କରିବା ଉଚିତ?',
    dataNotice: 'ସୂଚନା: କିଛି ରିଅଲ-ଟାଇମ ସମୁଦ୍ର ଡାଟା ଫିଡ୍ ଅଫଲାଇନ ଥିଲା। ସମୁଦ୍ରରେ ସର୍ବଦା ସତର୍କ ରୁହନ୍ତୁ।',
    defaultGo: 'GO – ସମୁଦ୍ର ପରିସ୍ଥିତି ସୁରକ୍ଷିତ',
    defaultCaution: 'CAUTION – ମଧ୍ୟମ ପରିସ୍ଥିତି',
    defaultDontGo: "DON'T GO – ବିପଜ୍ଜନକ ପରିସ୍ଥିତି",
    factorNames: {
      'Wave Height': 'ଢେଉ ଉଚ୍ଚତା',
      'Wind Speed': 'ପବନର ଗତି',
      'Wind Gusts': 'ଝଟକା ପବନ',
      'Ocean Current': 'ସାମୁଦ୍ରିକ ସ୍ରୋତ',
      'Thunderstorm & Lightning': 'ଝଡ଼ ଓ ବଜ୍ରପାତ',
      'Official INCOIS SVAS Advisory': 'ଅଫିସିଆଲ INCOIS SVAS ପରାମର୍ଶ',
      'Marine Hazards': 'ସାମୁଦ୍ରିକ ବିପଦ',
    },
  },
};

export const RiskExplanationCard: React.FC<RiskExplanationCardProps> = ({ explanation, language }) => {
  if (!explanation) {
    return null;
  }

  const effectiveLang = (language || explanation.language || 'en').toLowerCase().trim();
  const strings = LOCALIZED_LABELS[effectiveLang] || LOCALIZED_LABELS['en'];

  const {
    decision,
    decision_label,
    decision_subtitle,
    risk_score,
    dominant_hazard,
    primary_thing_to_watch,
    primary_thing_to_watch_reason,
    factors = [],
    action_guidance,
    vessel_evaluated,
  } = explanation;

  // Decision-based styling
  const getDecisionTheme = (dec: RiskDecision) => {
    switch (dec) {
      case 'GO':
        return {
          bg: COLORS.safeBg,
          border: COLORS.safeBorder,
          text: COLORS.safeText,
          iconBg: COLORS.safe,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#BBF7D0',
          scoreTextColor: COLORS.safeText,
          Icon: ShieldCheck,
          defaultLabel: strings.defaultGo,
        };
      case 'CAUTION':
        return {
          bg: COLORS.cautionBg,
          border: COLORS.cautionBorder,
          text: COLORS.cautionText,
          iconBg: COLORS.caution,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#FED7AA',
          scoreTextColor: COLORS.cautionText,
          Icon: AlertTriangle,
          defaultLabel: strings.defaultCaution,
        };
      case 'DONT_GO':
      default:
        return {
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
          text: COLORS.dangerText,
          iconBg: COLORS.danger,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#FECACA',
          scoreTextColor: COLORS.dangerText,
          Icon: AlertOctagon,
          defaultLabel: strings.defaultDontGo,
        };
    }
  };

  const theme = getDecisionTheme(decision);
  const DecisionIcon = theme.Icon;

  // Factor helper
  const getFactorIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wave') || lower.includes('swell')) return Waves;
    if (lower.includes('wind') || lower.includes('gust')) return Wind;
    if (lower.includes('lightning') || lower.includes('storm') || lower.includes('thunder') || lower.includes('convective')) return Zap;
    if (lower.includes('current')) return Compass;
    if (lower.includes('svas') || lower.includes('advisory') || lower.includes('incois')) return ShieldAlert;
    return Info;
  };

  const getStatusBadge = (status: RiskFactor['status']) => {
    switch (status) {
      case 'danger':
        return {
          label: strings.danger,
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
          text: COLORS.dangerText,
          dotColor: COLORS.danger,
        };
      case 'caution':
        return {
          label: strings.caution,
          bg: COLORS.cautionBg,
          border: COLORS.cautionBorder,
          text: COLORS.cautionText,
          dotColor: COLORS.caution,
        };
      case 'safe':
        return {
          label: strings.safe,
          bg: COLORS.safeBg,
          border: COLORS.safeBorder,
          text: COLORS.safeText,
          dotColor: COLORS.safe,
        };
      case 'unavailable':
      default:
        return {
          label: strings.noData,
          bg: COLORS.neutralBg,
          border: COLORS.neutralBorder,
          text: COLORS.neutralText,
          dotColor: COLORS.neutral,
        };
    }
  };

  const hasUnavailableFactors = factors.some((f) => f.status === 'unavailable');
  const cautionFactor = factors.find((f) => f.status === 'caution');

  return (
    <View style={styles.container}>
      {/* 1. TOP DECISION HERO BANNER (Single Authoritative Safety Decision) */}
      <View style={[styles.decisionBanner, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={styles.decisionTopRow}>
          <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
            <DecisionIcon size={24} color={theme.iconColor} />
          </View>
          <View style={styles.decisionTitles}>
            <Text style={[styles.decisionLabel, { color: theme.text }]}>
              {decision_label || theme.defaultLabel}
            </Text>
            {decision_subtitle && (
              <Text style={[styles.decisionSubtitle, { color: theme.text }]}>
                {decision_subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Secondary Badges (Score & Vessel) */}
        <View style={styles.badgeRow}>
          {risk_score !== undefined && (
            <View style={[styles.scoreBadge, { backgroundColor: theme.scoreBadgeBg }]}>
              <Text style={[styles.scoreBadgeText, { color: theme.scoreTextColor }]}>
                {strings.riskIndex}: {Math.round(risk_score)} / 100
              </Text>
            </View>
          )}

          {vessel_evaluated && (
            <View style={styles.vesselBadge}>
              <Anchor size={12} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
              <Text style={styles.vesselBadgeText}>{String(vessel_evaluated)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 2A. PRIMARY THING TO WATCH (When overall decision is GO and a secondary factor has caution) */}
      {decision === 'GO' && (primary_thing_to_watch || cautionFactor) && (
        <View style={styles.primaryWatchBox}>
          <AlertTriangle size={16} color={COLORS.caution} style={{ marginTop: 2, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryWatchLabel}>{strings.primaryThingToWatch}</Text>
            <Text style={styles.primaryWatchText}>
              🟡 {primary_thing_to_watch || (cautionFactor?.name ? (strings.factorNames[cautionFactor.name] || cautionFactor.name) : '')}
              {primary_thing_to_watch_reason
                ? ` — ${primary_thing_to_watch_reason}`
                : cautionFactor?.interpretation
                ? ` — ${cautionFactor?.interpretation}`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* 2B. DOMINANT HAZARD ALERT (When decision is CAUTION or DONT_GO) */}
      {decision !== 'GO' && dominant_hazard && (
        <View style={[styles.dominantHazardBox, decision === 'CAUTION' && styles.dominantHazardBoxCaution]}>
          {decision === 'DONT_GO' ? (
            <AlertOctagon size={16} color={COLORS.danger} style={{ marginTop: 2, marginRight: 8 }} />
          ) : (
            <AlertTriangle size={16} color={COLORS.caution} style={{ marginTop: 2, marginRight: 8 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.dominantHazardLabel,
                decision === 'CAUTION' && { color: COLORS.cautionText },
              ]}
            >
              {decision === 'DONT_GO' ? strings.primarySafetyConcern : strings.primaryHazardToMonitor}
            </Text>
            <Text style={styles.dominantHazardText}>
              {strings.factorNames[dominant_hazard] || dominant_hazard}
            </Text>
          </View>
        </View>
      )}

      {/* 3. "WHY THIS DECISION?" FACTOR BREAKDOWN */}
      <View style={styles.factorsSection}>
        <Text style={styles.sectionHeader}>{strings.whyThisDecision}</Text>
        <Text style={styles.sectionSubheader}>
          {strings.evaluatedAgainstLimits}
        </Text>

        <View style={styles.factorsList}>
          {factors.map((factor, idx) => {
            const FactorIcon = getFactorIcon(factor.name);
            const statusBadge = getStatusBadge(factor.status);
            const factorDisplayName = strings.factorNames[factor.name] || factor.name;

            return (
              <View
                key={`factor-${idx}-${factor.name}`}
                style={[
                  styles.factorCard,
                  factor.status === 'danger' && styles.factorCardDanger,
                  factor.status === 'caution' && styles.factorCardCaution,
                  factor.status === 'unavailable' && styles.factorCardUnavailable,
                ]}
              >
                {/* Header: Icon + Name + Formatted Value + Status */}
                <View style={styles.factorHeaderRow}>
                  <View style={styles.factorNameGroup}>
                    <View style={styles.factorIconWrapper}>
                      <FactorIcon size={16} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.factorName}>{factorDisplayName}</Text>
                      <Text style={styles.factorValue}>{factor.value_formatted}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: statusBadge.dotColor }]} />
                    <Text style={[styles.statusText, { color: statusBadge.text }]}>
                      {statusBadge.label}
                    </Text>
                  </View>
                </View>

                {/* Practical Fisherman Interpretation */}
                {factor.interpretation && (
                  <Text style={styles.factorInterpretation}>{factor.interpretation}</Text>
                )}

                {/* Optional Threshold Context */}
                {factor.threshold_context && (
                  <View style={styles.thresholdRow}>
                    <Info size={11} color={COLORS.textTertiary} style={{ marginRight: 4 }} />
                    <Text style={styles.thresholdText}>{factor.threshold_context}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 4. "WHAT SHOULD I DO?" ACTION GUIDANCE */}
      {action_guidance && (
        <View
          style={[
            styles.actionBox,
            action_guidance.urgency === 'critical' && styles.actionBoxCritical,
            action_guidance.urgency === 'moderate' && styles.actionBoxModerate,
          ]}
        >
          <View style={styles.actionHeaderRow}>
            <ArrowRight
              size={16}
              color={
                action_guidance.urgency === 'critical'
                  ? COLORS.danger
                  : action_guidance.urgency === 'moderate'
                  ? COLORS.caution
                  : COLORS.oceanBlue
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.actionHeadline,
                action_guidance.urgency === 'critical' && { color: COLORS.dangerText },
                action_guidance.urgency === 'moderate' && { color: COLORS.cautionText },
              ]}
            >
              {(action_guidance.headline === 'What Should You Do?'
                ? strings.whatShouldYouDo
                : action_guidance.headline) || strings.recommendedAction}
            </Text>
          </View>
          <Text style={styles.actionText}>{action_guidance.action_text}</Text>
        </View>
      )}

      {/* 5. DATA FEED NOTICE IF MISSING FACTORS */}
      {hasUnavailableFactors && (
        <View style={styles.noticeBox}>
          <HelpCircle size={13} color={COLORS.neutral} style={{ marginRight: 6, marginTop: 1 }} />
          <Text style={styles.noticeText}>
            {strings.dataNotice}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  decisionBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  decisionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  decisionTitles: {
    flex: 1,
  },
  decisionLabel: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    lineHeight: 22,
  },
  decisionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
    opacity: 0.9,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  scoreBadgeText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  vesselBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.skyBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
  },
  vesselBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  primaryWatchBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  primaryWatchLabel: {
    ...TYPOGRAPHY.caption,
    color: '#B45309',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryWatchText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  dominantHazardBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dominantHazardBoxCaution: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDBA74',
  },
  dominantHazardLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dominantHazardText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  factorsSection: {
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionSubheader: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  factorsList: {
    gap: 8,
  },
  factorCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.sm,
  },
  factorCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: COLORS.dangerBorder,
  },
  factorCardCaution: {
    backgroundColor: '#FFFBEB',
    borderColor: COLORS.cautionBorder,
  },
  factorCardUnavailable: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.border,
  },
  factorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factorIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  factorName: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  factorValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  factorInterpretation: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  thresholdText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  actionBox: {
    backgroundColor: COLORS.skyBlue,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  actionBoxCritical: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  actionBoxModerate: {
    backgroundColor: COLORS.cautionBg,
    borderColor: COLORS.cautionBorder,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionHeadline: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.oceanBlueDark,
    letterSpacing: 0.5,
  },
  actionText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontWeight: '600',
    lineHeight: 19,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
    padding: SPACING.xs,
  },
  noticeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textTertiary,
    flex: 1,
    lineHeight: 15,
  },
});
