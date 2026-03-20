import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  message: string | null
  onDone: () => void
}

export default function Toast({ message, onDone }: Props) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 229, 255, 0.12)',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: '10px 20px',
            color: '#80f0ff',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 500,
            whiteSpace: 'nowrap',
            boxShadow: '0 0 20px rgba(0, 200, 255, 0.2)',
          }}
        >
          ✦ {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
