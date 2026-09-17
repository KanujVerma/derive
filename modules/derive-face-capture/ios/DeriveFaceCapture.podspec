require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DeriveFaceCapture'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = 'Derive'
  s.homepage       = 'https://derive.skin'
  s.platforms      = {
    :ios => '16.0'
  }
  s.source         = { git: '' }

  s.dependency 'ExpoModulesCore'

  s.static_framework = true
  s.source_files = "**/*.{h,m,swift}"
  s.frameworks = 'AVFoundation', 'Vision', 'UIKit'
end
