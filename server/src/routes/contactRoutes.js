import { Router } from 'express'
import Contact from '../models/Contact.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// GET /api/contacts — Listar contactos
router.get('/', authenticate, async (req, res) => {
  try {
    const contacts = await Contact.getByUser(req.user.id)
    res.json({ contacts })
  } catch (err) {
    console.error('Get contacts error:', err)
    res.status(500).json({ error: 'Error al obtener contactos' })
  }
})

// POST /api/contacts — Agregar contacto
router.post('/', authenticate, async (req, res) => {
  try {
    const { contactId, nickname } = req.body
    if (!contactId) return res.status(400).json({ error: 'contactId requerido' })
    if (contactId === req.user.id) return res.status(400).json({ error: 'No puedes agregarte a ti mismo' })
    
    const added = await Contact.add(req.user.id, contactId, nickname || null)
    if (!added) return res.json({ message: 'Ya está en tus contactos' })
    
    // Return the full contact info
    const contacts = await Contact.getByUser(req.user.id)
    const contact = contacts.find(c => c.contact_id === contactId)
    res.status(201).json({ contact })
  } catch (err) {
    console.error('Add contact error:', err)
    res.status(500).json({ error: 'Error al agregar contacto' })
  }
})

// DELETE /api/contacts/:contactId — Eliminar contacto
router.delete('/:contactId', authenticate, async (req, res) => {
  try {
    const removed = await Contact.remove(req.user.id, req.params.contactId)
    if (!removed) return res.status(404).json({ error: 'Contacto no encontrado' })
    res.json({ message: 'Contacto eliminado' })
  } catch (err) {
    console.error('Remove contact error:', err)
    res.status(500).json({ error: 'Error al eliminar contacto' })
  }
})

export default router
