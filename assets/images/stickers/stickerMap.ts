// Local sticker image asset map for React Native
export const LOCAL_STICKER_MAP: Record<string, any> = {
  // Reactions
  '/images/stickers/reactions/Laughing.png': require('./reactions/Laughing.png'),
  '/images/stickers/reactions/Confused.png': require('./reactions/Confused.png'),
  '/images/stickers/reactions/Surprised .png': require('./reactions/Surprised .png'),
  '/images/stickers/reactions/Annoyed.png': require('./reactions/Annoyed.png'),
  '/images/stickers/reactions/Smug.png': require('./reactions/Smug.png'),
  '/images/stickers/reactions/Derp.png': require('./reactions/Derp.png'),
  '/images/stickers/reactions/Mischievous .jpeg': require('./reactions/Mischievous .jpeg'),
  '/images/stickers/reactions/Worried.png': require('./reactions/Worried.png'),
  '/images/stickers/reactions/Pleading.png': require('./reactions/Pleading.png'),
  '/images/stickers/reactions/Sleepy.png': require('./reactions/Sleepy.png'),
  '/images/stickers/reactions/Dancing.png': require('./reactions/Dancing.png'),

  // Greetings
  '/images/stickers/greetings/Hello.png': require('./greetings/Hello.png'),
  '/images/stickers/greetings/Cheers.png': require('./greetings/Cheers.png'),
  '/images/stickers/greetings/Thank you.png': require('./greetings/Thank you.png'),
  "/images/stickers/greetings/You’re welcome.png": require('./greetings/You’re welcome.png'),
  '/images/stickers/greetings/Good Job.png': require('./greetings/Good Job.png'),

  // Emotions
  '/images/stickers/emotions/Heart Eyes.png': require('./emotions/Heart Eyes.png'),
  '/images/stickers/emotions/Huggie.png': require('./emotions/Huggie.png'),
  '/images/stickers/emotions/Relaxed.png': require('./emotions/Relaxed.png'),
  '/images/stickers/emotions/Teasing_.png': require('./emotions/Teasing_.png'),
  '/images/stickers/emotions/Stop.png': require('./emotions/Stop.png'),

  // Thinking
  '/images/stickers/thinking/Thinking.png': require('./thinking/Thinking.png'),
  '/images/stickers/thinking/Detective .png': require('./thinking/Detective .png'),
  '/images/stickers/thinking/Taking Notes.png': require('./thinking/Taking Notes.png'),

  // Funny
  '/images/stickers/funny/Bozo.png': require('./funny/Bozo.png'),
  '/images/stickers/funny/Music.png': require('./funny/Music.png'),
  '/images/stickers/funny/Just here.jpeg': require('./funny/Just here.jpeg'),
  '/images/stickers/funny/W.E2.png': require('./funny/W.E2.png'),
  '/images/stickers/funny/WE1.png': require('./funny/WE1.png'),
};

export function getLocalStickerSource(url: string | undefined): any | null {
  if (!url) return null;
  // Match relative path
  if (LOCAL_STICKER_MAP[url]) return LOCAL_STICKER_MAP[url];

  // Try matching stripped domain if full URL passed
  for (const [key, asset] of Object.entries(LOCAL_STICKER_MAP)) {
    if (url.includes(key) || key.includes(url)) {
      return asset;
    }
  }
  return null;
}
