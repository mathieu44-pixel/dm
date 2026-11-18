import { describe, expect, it } from 'vitest'
import { articleLinks, parseWikiUrl, wikiApiUrl } from './mediawiki'

describe('parseWikiUrl', () => {
  it('lit les adresses Fandom', () => {
    expect(parseWikiUrl('https://umamusume.fandom.com/wiki/Umamusume_Wiki')).toEqual({
      origin: 'https://umamusume.fandom.com',
      title: 'Umamusume_Wiki',
      apiCandidates: ['https://umamusume.fandom.com/api.php'],
    })
  })
  it('lit les wikis sans /wiki/ et les liens index.php', () => {
    expect(parseWikiUrl('https://umamusu.wiki/List_of_Characters#top')).toMatchObject({ title: 'List_of_Characters' })
    expect(parseWikiUrl('https://umamusu.wiki/index.php?title=Special%20Week')).toMatchObject({ title: 'Special_Week' })
    expect(parseWikiUrl('https://umamusu.wiki/')).toMatchObject({ title: null, apiCandidates: ['https://umamusu.wiki/api.php', 'https://umamusu.wiki/w/api.php'] })
  })
  it('refuse ce qui n’est pas un lien', () => {
    expect(parseWikiUrl('umamusume')).toBeNull()
  })
})

describe('wikiApiUrl', () => {
  it('demande une lecture anonyme en JSON', () => {
    const url = new URL(wikiApiUrl('https://x.wiki/api.php', { action: 'query', meta: 'siteinfo' }))
    expect(url.searchParams.get('origin')).toBe('*')
    expect(url.searchParams.get('format')).toBe('json')
    expect(url.searchParams.get('meta')).toBe('siteinfo')
  })
})

describe('articleLinks', () => {
  it('garde les articles existants, sans doublons', () => {
    expect(
      articleLinks([
        { ns: 0, title: 'Special Week' },
        { ns: 14, title: 'Category:Uma' },
        { ns: 0, title: 'Special Week' },
        { ns: 0, title: 'Absent', exists: false },
      ]),
    ).toEqual(['Special Week'])
  })
})
