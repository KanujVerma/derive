require 'xcodeproj'
dir = File.expand_path(ARGV.fetch(0))
Dir.mkdir(dir) unless Dir.exist?(dir)
p = Xcodeproj::Project.new("#{dir}/PartThreeUI.xcodeproj")
t = p.new_target(:ui_test_bundle, 'PartThreeUI', :ios, '16.4')
f=p.main_group.new_file(File.join(__dir__, "PartThreeUI.swift"));t.source_build_phase.add_file_reference(f)
t.build_configurations.each do |c|
 c.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.derive.partthree-ui-tests'
 c.build_settings['GENERATE_INFOPLIST_FILE']='YES'
 c.build_settings['SWIFT_VERSION']='5.0'
 c.build_settings['CODE_SIGNING_ALLOWED']='NO'
end
p.save
s=Xcodeproj::XCScheme.new;s.add_build_target(t);s.add_test_target(t);s.save_as(p.path,'PartThreeUI')
