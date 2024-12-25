import React, { Component } from 'react'

export class PictureSelect extends Component {
  itemPictTemplate(item) {
    return (
      <div
        key={item.itemImageSrc + 'IMG'}
        style={{ height: '25vh', top: '0px', position: 'relative' }}
      >
        <img
          src={item.itemImageSrc}
          key={item.itemImageSrc + 'IMGBody'}
          alt={item.title || item.alt}
          style={{
            width: 'auto',
            height: 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'block',
            backgroundImage: 'url(' + item.thumbnailImageSrc + ')',
            backgroundSize: 'contain'
          }}
        />
        <span
          style={{
            right: 0,
            bottom: 0,
            position: 'absolute',
            color: '#2196F3'
          }}
        >
          {' '}
          {item.title || item.alt}
        </span>
      </div>
    )
  }

  thumbnailPictTemplate({ index, posy, pict, numThumbnails, active }) {
    const imgstyles = {
      width: '100%',
      height: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
      objectFit: 'contain',
      display: 'block',
      opacity: 1,
      transition: 'opacity 1s'
    }

    if (!active) {
      imgstyles.pointerEvents = 'none'
      imgstyles.opacity = 0
    }
    return (
      <div
        key={index + pict.itemImageSrc + 'IMGBody'}
        style={{
          width: (1 / numThumbnails) * 88 + '%',
          height: '100%',
          position: 'absolute',
          left: posy * 100 + '%',
          transition: 'left 1s'
        }}
      >
        <img
          src={pict?.thumbnailImageSrc}
          key={index + pict.itemImageSrc + 'IMGBodyThumb'}
          alt={pict?.alt}
          style={imgstyles}
          onClick={() => {
            this.props.onItemChange({ index })
          }}
        />
      </div>
    )
  }

  render() {
    const activeIndex = this.props.activeIndex || 0
    const value = this.props.value
    const numPicts = this.props.value?.length

    const numThumbnails = 3

    let thumbnailStart = activeIndex - Math.floor(numThumbnails * 0.5)
    if (thumbnailStart < 0) thumbnailStart = 0
    if (thumbnailStart + numThumbnails > numPicts) {
      thumbnailStart = Math.max(0, numPicts - numThumbnails)
    }
    let activeThumbs = thumbnailStart
    let activeLength = Math.min(numThumbnails, numPicts)
    if (thumbnailStart - 1 >= 0) {
      activeThumbs = thumbnailStart - 1
      activeLength++
    }
    if (activeThumbs + activeLength + 1 <= numPicts) {
      activeLength++
    }
    return (
      <div style={{ aspectRatio: 1, width: '100%' }}>
        <div style={{ height: '90%' }}>
          {typeof activeIndex !== 'undefined' &&
            activeIndex < numPicts &&
            this.itemPictTemplate(value[activeIndex])}
        </div>
        <div
          style={{
            position: 'relative',
            bottom: 0,
            height: '50px',
            overflow: 'hidden'
          }}
        >
          {[...Array(activeLength).keys()].map((ind) =>
            this.thumbnailPictTemplate({
              index: activeThumbs + ind,
              posy:
                ((ind - thumbnailStart + activeThumbs) / numThumbnails) * 0.9 +
                0.05,
              numThumbnails,
              active:
                activeThumbs + ind >= thumbnailStart &&
                activeThumbs + ind < thumbnailStart + numThumbnails,
              pict: value[activeThumbs + ind]
            })
          )}
          <i
            className='pi pi-chevron-left'
            style={{
              fontSize: '2rem',
              position: 'absolute',
              left: '0',
              lineHeight: '3rem'
            }}
            onClick={() => {
              this.props.onItemChange({
                index: Math.max(0, activeIndex - 1)
              })
            }}
          ></i>
          <i
            className='pi pi-chevron-right'
            style={{
              fontSize: '2rem',
              position: 'absolute',
              right: '0',
              display: 'flex',
              alignItems: 'center',
              lineHeight: '3rem'
            }}
            onClick={() => {
              this.props.onItemChange({
                index: Math.min(activeIndex + 1, numPicts - 1)
              })
            }}
          ></i>
        </div>
      </div>
    )
  }
}
