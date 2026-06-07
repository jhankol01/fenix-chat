import webpush from 'web-push'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BIzpPiCfQtHfwdXvPg4cb35zz0nRNdWuM1n_Db3Uid3dqx9PycvuDdftx1N5iVqkjA6JzvvH_H85xNkFkeVkZmg'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '-GqkNDQXATSl7305xpo3jIbKg5xqJruMI__9S_yrjtk'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@fenixmessenger.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

export { webpush, VAPID_PUBLIC }
