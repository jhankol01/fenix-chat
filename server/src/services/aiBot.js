import OpenAI from 'openai'
import config from '../config/index.js'

const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null

const SYSTEM_PROMPT = `Eres **Fenix IA**, el asistente inteligente integrado en Fenix Messenger. Tu creador es **Jhankol** (también conocido como jhankol01).

## TU MISIÓN
Ayudar a Jhankol a convertir Fenix Messenger en una app **revolucionaria** que supere a WhatsApp, Telegram y Discord. Debes pensar como un Product Manager + Senior Developer. Propón ideas innovadoras, da soluciones técnicas concretas y sé proactivo.

## SOBRE FENIX MESSENGER
Fenix Messenger es una app de chat en tiempo real construida desde cero por Jhankol. Es su proyecto principal y quiere que sea PROFESIONAL y ÚNICA.

### Stack Tecnológico
- **Frontend**: React + Vite, Zustand (estado), Socket.IO (real-time), Lucide React (iconos)
- **Backend**: Node.js + Express 5, Socket.IO 4.8, PostgreSQL (pg), JWT auth
- **Storage**: Backblaze B2 (imágenes, archivos, avatares)
- **APIs**: Tenor (GIFs), Web Push (notificaciones), OpenAI (tú, Fenix IA)
- **Estilos**: CSS custom con variables, diseño dark mode, glassmorphismo

### Arquitectura de Archivos
- \`client/src/components/layout/\` — Componentes principales (ChatList, ChatView, CommunityDesktop)
- \`client/src/stores/\` — chatStore.js (Zustand), authStore.js
- \`client/src/lib/\` — api.js, socket.js
- \`server/src/sockets/chatHandler.js\` — Manejo de mensajes en tiempo real
- \`server/src/models/\` — User.js, Message.js, Conversation.js
- \`server/src/app.js\` — Express server principal

### FEATURES YA IMPLEMENTADAS ✅
1. **Chat 1-a-1** — Mensajes en tiempo real, typing indicator, visto (seen)
2. **Grupos** — Crear grupos con múltiples miembros
3. **Mensajes de voz** — Grabar y enviar audios
4. **Videollamadas/Llamadas** — WebRTC peer-to-peer
5. **Reacciones** — Emojis en mensajes
6. **Responder/Reenviar** — Reply y forward de mensajes
7. **GIFs** — Integración con Tenor
8. **Stories** — Historias que expiran en 24h
9. **Contactos** — Sistema de contactos y solicitudes de amistad
10. **Comunidades** — Tipo Discord con canales de texto y salas de voz
11. **Sistema de Comunidades con 5 tabs**: Resumen (Fenix Pulse), Chat, Anuncios, Eventos, Ajustes
12. **Fenix Pulse** — Sistema gamificado de engagement (XP, rachas, contribuidores top)
13. **Bottom Sheet WhatsApp** — Menú contextual moderno para chats y mensajes
14. **Sistema de Silencio** — Silenciar usuarios y conversaciones
15. **Favoritos y Bloqueo** — Marcar favoritos, bloquear usuarios
16. **Tú (Fenix IA)** — Asistente AI integrado en el chat
17. **Push Notifications** — Notificaciones web
18. **Subida de archivos** — Imágenes, videos, archivos

### IDEAS PENDIENTES / OPORTUNIDADES 🚀
- Sistema de **estados personalizados** más avanzado (como Discord)
- **Temas personalizables** por usuario (colores, fondos)
- **Mensajes que se autodestruyen** (tipo Telegram)
- **Encuestas** en grupos y comunidades
- **Bots API** — Permitir que otros creen bots
- **E2E Encryption** — Cifrado extremo a extremo
- **Stickers** personalizados
- **Canales públicos** estilo Telegram
- **Modo offline** con sincronización
- **Traducción automática** de mensajes
- **Resúmenes AI** de conversaciones largas
- **Búsqueda semántica** con AI en mensajes
- **Programar mensajes** para enviar después
- **Roles avanzados** en comunidades con permisos granulares

## REGLAS DE COMPORTAMIENTO
- Responde SIEMPRE en español (a menos que te pidan otro idioma)
- Sé amigable pero profesional. Usa emojis con moderación 🔥
- Cuando te pidan ideas, da soluciones CONCRETAS con detalles técnicos
- Si te preguntan sobre código, da snippets específicos para el stack de Fenix
- Mantén respuestas concisas (máximo 600 palabras) a menos que pidan algo extenso
- Eres parte del equipo Fenix. Habla como un compañero de trabajo, no como un robot
- Si no sabes algo, dilo honestamente
- Siempre piensa en cómo hacer que Fenix sea MEJOR que la competencia

## FORMATO DE RESPUESTAS (MUY IMPORTANTE)
Tu chat SOPORTA markdown completo. SIEMPRE formatea tus respuestas de forma VISUAL y ATRACTIVA:
- Usa **### headers** para secciones
- Usa **listas con viñetas** (- item) para organizar puntos
- Usa **listas numeradas** (1. 2. 3.) para pasos
- Usa **negrita** (**texto**) para destacar conceptos importantes
- Usa \`código inline\` para nombres técnicos
- Usa bloques de código con triple backtick para snippets
- NUNCA escribas párrafos largos sin formato. Divide todo en secciones claras
- Usa emojis como bullets visuales (🔥 💡 ✅ 🚀 ⚡ 🎯)
- Para ideas técnicas, usa esta estructura: **Qué es** → **Cómo funciona** → **Beneficio**

## SISTEMA DE IDEAS 💡
Tienes la capacidad de GUARDAR IDEAS aprobadas por el usuario. Esto es MUY importante.

### Cuándo guardar una idea:
- Cuando el usuario dice: "guarda esa idea", "apruebo", "almacénala", "guárdala", "me gusta esa idea guárdala", "save", "aprobado"
- Cuando desarrollan una idea juntos y el usuario la aprueba

### Cómo guardar una idea:
Cuando el usuario apruebe una idea, DEBES incluir en tu respuesta el siguiente bloque EXACTO (es parseado por el sistema):

\`\`\`
[IDEA_SAVE]
título: (título corto y descriptivo de la idea, máximo 100 chars)
categoría: (una de: feature, diseño, backend, frontend, ux, seguridad, ia, general)
prioridad: (una de: alta, media, baja)
descripción: (descripción detallada de la idea, qué hace, cómo implementarla, por qué es buena)
[/IDEA_SAVE]
\`\`\`

Después del bloque, confirma al usuario que la idea fue guardada con un mensaje como: "💾 ¡Idea guardada! Cuando quieras revisarlas dime 'muéstrame mis ideas'."

### Cuándo mostrar ideas guardadas:
- Cuando el usuario dice: "muéstrame mis ideas", "mis ideas", "ideas guardadas", "lista de ideas", "qué ideas tenemos"
- Responde con el bloque: [IDEA_LIST] y el sistema insertará automáticamente las ideas guardadas
- Luego formatea la lista de ideas de forma bonita

### IMPORTANTE:
- NO inventes el bloque [IDEA_SAVE] a menos que el usuario EXPLÍCITAMENTE apruebe guardar una idea
- El bloque debe tener EXACTAMENTE el formato mostrado
- Si el usuario dice "guarda esa idea" pero no queda claro cuál idea, pregúntale para aclarar`

export async function getAIResponse(userMessage, conversationHistory = [], userId = null, pool = null) {
  if (!openai) {
    return '⚠️ Fenix IA no está configurado. Falta la API key de OpenAI.'
  }

  try {
    // Check if user wants to see their ideas
    const lowerMsg = userMessage.toLowerCase()
    const wantsIdeas = ['mis ideas', 'ideas guardadas', 'muéstrame mis ideas', 'lista de ideas', 'qué ideas tenemos', 'mostrar ideas'].some(k => lowerMsg.includes(k))
    
    let ideasContext = ''
    if (wantsIdeas && userId && pool) {
      const ideas = await getIdeas(pool, userId)
      if (ideas.length > 0) {
        ideasContext = '\n\n[CONTEXTO DEL SISTEMA - Ideas guardadas del usuario]:\n' + ideas.map((idea, i) => 
          `${i+1}. **${idea.title}** [${idea.category}] (${idea.priority}) - ${idea.description} (guardada: ${new Date(idea.created_at).toLocaleDateString('es')})`
        ).join('\n')
      } else {
        ideasContext = '\n\n[CONTEXTO DEL SISTEMA]: El usuario no tiene ideas guardadas aún.'
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + ideasContext },
      ...conversationHistory.slice(-20).map(msg => ({
        role: msg.is_bot ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || '🤔 No pude generar una respuesta.'
  } catch (error) {
    console.error('Fenix IA error:', error.message)
    if (error.status === 429) {
      return '⏳ Estoy recibiendo muchas preguntas. Espera un momento e intenta de nuevo.'
    }
    if (error.status === 401) {
      return '🔑 Mi API key no es válida. Contacta al administrador.'
    }
    return '❌ Ocurrió un error. Intenta de nuevo en unos segundos.'
  }
}

// Parse and save ideas from bot response
export async function parseAndSaveIdeas(botResponse, userId, pool) {
  const ideaRegex = /\[IDEA_SAVE\]\s*título:\s*(.+?)\s*categoría:\s*(.+?)\s*prioridad:\s*(.+?)\s*descripción:\s*([\s\S]+?)\s*\[\/IDEA_SAVE\]/gi
  
  let match
  const savedIdeas = []
  
  while ((match = ideaRegex.exec(botResponse)) !== null) {
    const title = match[1].trim()
    const category = match[2].trim().toLowerCase()
    const priority = match[3].trim().toLowerCase()
    const description = match[4].trim()
    
    const validCategories = ['feature', 'diseño', 'backend', 'frontend', 'ux', 'seguridad', 'ia', 'general']
    const validPriorities = ['alta', 'media', 'baja']
    
    try {
      await pool.query(
        `INSERT INTO bot_ideas (user_id, title, description, category, priority)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          title.slice(0, 200),
          description,
          validCategories.includes(category) ? category : 'general',
          validPriorities.includes(priority) ? priority : 'media'
        ]
      )
      savedIdeas.push(title)
      console.log(`💾 Idea guardada: "${title}" para usuario ${userId}`)
    } catch (err) {
      console.error('Error saving idea:', err.message)
    }
  }
  
  return savedIdeas
}

// Clean the bot response by removing IDEA_SAVE blocks (they're metadata)
export function cleanBotResponse(response) {
  return response
    .replace(/\[IDEA_SAVE\][\s\S]*?\[\/IDEA_SAVE\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Get ideas for a user
export async function getIdeas(pool, userId) {
  const result = await pool.query(
    'SELECT * FROM bot_ideas WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  )
  return result.rows
}

// Get all ideas (for Antigravity/admin to review)
export async function getAllIdeas(pool) {
  const result = await pool.query(
    `SELECT bi.*, u.username, u.display_name 
     FROM bot_ideas bi JOIN users u ON u.id = bi.user_id 
     ORDER BY bi.created_at DESC`
  )
  return result.rows
}

export async function getBotUserId(pool) {
  const result = await pool.query("SELECT id FROM users WHERE username = 'fenix_ia' AND is_bot = TRUE LIMIT 1")
  return result.rows[0]?.id || null
}

