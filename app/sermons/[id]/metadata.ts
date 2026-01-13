import { Metadata } from 'next'

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
        return {
          title: `${sermon.title} | FX Archive`,
          description: sermon.description || `Sermon transcript for ${sermon.title}`,
          openGraph: {
            title: sermon.title,
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
    title: 'Sermon | FX Archive',
    description: 'Sermon transcript archive',
  }
}
