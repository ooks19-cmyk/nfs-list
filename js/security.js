/**
 * security.js - 비밀번호 해싱 및 보안 유틸리티
 * Web Crypto API를 사용하여 브라우저 환경에서 안전한 SHA-256 해시를 생성합니다.
 */

export const Security = {
  /**
   * 문자열을 SHA-256으로 해싱합니다.
   * @param {string} message - 평문 비밀번호
   * @returns {Promise<string>} 64자리 16진수 해시 문자열
   */
  async hashPassword(message) {
    if (!message) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(message.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 입력된 평문 비밀번호가 저장된 해시와 일치하는지 검증합니다.
   * @param {string} inputPassword - 사용자가 입력한 평문 비밀번호
   * @param {string} storedHash - 저장된 SHA-256 해시
   * @returns {Promise<boolean>} 일치 여부
   */
  async verifyPassword(inputPassword, storedHash) {
    if (!inputPassword || !storedHash) return false;
    const inputHash = await this.hashPassword(inputPassword);
    return inputHash === storedHash;
  },

  /**
   * 네이버 지도 링크 형식인지 유효성을 검사합니다.
   * @param {string} url - 검사할 URL 문자열
   * @returns {boolean}
   */
  isValidNaverMapUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim();
    return (
      cleanUrl.includes('naver.me') ||
      cleanUrl.includes('map.naver.com') ||
      cleanUrl.startsWith('http://') ||
      cleanUrl.startsWith('https://')
    );
  },

  /**
   * 문자열에서 네이버 지도 URL을 추출합니다. (예: "[네이버지도]구미맛집 https://naver.me/xJcslhFt" 형태 지원)
   * @param {string} text - 원본 텍스트 또는 URL
   * @returns {string} 순수 URL
   */
  extractUrl(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : text.trim();
  }
};
