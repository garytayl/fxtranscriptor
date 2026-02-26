import { Metadata } from 'next'
import { decodeHtmlEntities } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/catalog/${id}`, {
      cache: 'no-store',
    })
    
    if (response.ok) {
      const data = await response.json()
      const sermon = data.sermon
      
      if (sermon) {
        const title = decodeHtmlEntities(sermon.title)
        return {
          title: `${title} | fxarchives`,
          description: sermon.description || `Sermon transcript for ${title}`,
          openGraph: {
            title,
            description: sermon.description || `Sermon transcript`,
            type: 'article',
            publishedTime: sermon.date || undefined,
          },
        }
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
  }
  
  return {
    title: 'Sermon | fxarchives',
    description: 'Sermon transcript archive',
  }
}
