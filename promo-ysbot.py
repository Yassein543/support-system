import bpy, math, os
from mathutils import Vector

OUT_DIR = r"C:\Users\yasse\مجلد جديد\YS-Bot-Promo"
ASSET_BANNER = r"C:\Users\yasse\مجلد جديد\ys-bot-banner.png"
BLEND_PATH = os.path.join(OUT_DIR, "YS-Bot-Promo.blend")
VIDEO_PATH = os.path.join(OUT_DIR, "YS-Bot-Promo.mp4")
os.makedirs(OUT_DIR, exist_ok=True)

# Reset the unsaved default scene and build a fully editable branded motion graphic.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
    pass

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 288
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.media_type = 'VIDEO'
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
scene.render.filepath = VIDEO_PATH
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.color_mode = 'RGB'
scene.render.use_file_extension = True
scene.render.resolution_percentage = 100
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 32

world = bpy.data.worlds.new('YS | Deep Navy World') if not bpy.data.worlds else bpy.data.worlds[0]
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.006, 0.016, 0.032, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.4

def emission(name, color, strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(em.outputs[0], out.inputs['Surface'])
    return mat

def surface(name, color, metallic=0.2, roughness=0.3, glow=(0,0,0), glow_power=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = (*glow, 1)
        bsdf.inputs['Emission Strength'].default_value = glow_power
    return mat

NAVY = surface('YS | Obsidian Navy', (0.008, 0.035, 0.065), 0.45, 0.28, (0.015, 0.10, 0.15), 0.4)
PANEL = surface('YS | Glass Panel', (0.014, 0.065, 0.095), 0.28, 0.22, (0.015,0.12,0.14), 0.28)
MINT = emission('YS | Electric Mint', (0.12, 0.96, 0.78), 1.8)
CYAN = emission('YS | Ice Blue', (0.20, 0.63, 1.0), 1.7)
VIOLET = emission('YS | Signal Violet', (0.43, 0.39, 1.0), 1.6)
WHITE = emission('YS | Soft White', (0.86, 0.95, 1.0), 1.0)
MUTED = emission('YS | Muted Text', (0.36, 0.56, 0.66), 0.8)
SHIELD_FILL = surface('YS | Shield Enamel', (0.015, 0.095, 0.14), 0.55, 0.23, (0.01,0.18,0.2), 0.35)

def add_camera():
    bpy.ops.object.camera_add(location=(0, 0, 22))
    cam = bpy.context.object
    cam.name = 'YS | Motion Graphics Camera'
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 18
    cam.data.lens = 50
    cam.rotation_euler = (0, 0, 0)
    scene.camera = cam
    return cam

cam = add_camera()

def parent_to(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

def group(name):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.empty_display_type = 'SPHERE'
    obj.empty_display_size = 0.15
    return obj

def animate_pop(obj, start, end, start_scale=0.001, overshoot=1.07):
    obj.scale = (start_scale, start_scale, start_scale)
    obj.keyframe_insert(data_path='scale', frame=start)
    obj.scale = (overshoot, overshoot, overshoot)
    obj.keyframe_insert(data_path='scale', frame=start+9)
    obj.scale = (1,1,1)
    obj.keyframe_insert(data_path='scale', frame=start+16)
    obj.scale = (1,1,1)
    obj.keyframe_insert(data_path='scale', frame=end-7)
    obj.scale = (0.001,0.001,0.001)
    obj.keyframe_insert(data_path='scale', frame=end)

def rounded_box(name, loc, dims, material, bevel=0.18, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel_mod = obj.modifiers.new('Soft machined edges', 'BEVEL')
    bevel_mod.width = bevel
    bevel_mod.segments = 5
    obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    if parent: parent_to(obj, parent)
    return obj

def text_obj(name, text, loc, size, material, font=None, align='LEFT', parent=None, extrude=0.005):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = text
    data.size = size
    data.align_x = align
    data.align_y = 'CENTER'
    data.extrude = extrude
    data.bevel_depth = 0.0015
    data.bevel_resolution = 2
    if font:
        try: data.font = font
        except: pass
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    data.materials.append(material)
    if parent: parent_to(obj, parent)
    return obj

def curve_line(name, points, material, bevel=0.025, parent=None, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth = bevel
    data.bevel_resolution = 4
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    if parent: parent_to(obj, parent)
    return obj

def filled_polygon(name, points, material, z, parent=None):
    verts = [(x,y,z) for x,y in points]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    if parent: parent_to(obj, parent)
    return obj

def circle(name, loc, radius, material, parent=None, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    if parent: parent_to(obj, parent)
    return obj

# Dark cinematic backdrop with subtle concentric orbital lines.
rounded_box('YS | Infinite navy backdrop', (0,0,-3), (200,120,0.2), NAVY, 0.1)
for idx, radius in enumerate((4.5, 5.1, 5.7, 6.3)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.012 if idx%2==0 else 0.007, major_segments=128, minor_segments=8, location=(0.0,0.0,-2.65+idx*0.01))
    ring = bpy.context.object
    ring.name = f'YS | Orbit {idx+1}'
    ring.data.materials.append(MUTED if idx%2 else MINT)
    ring.rotation_euler[2] = idx * 0.22
    ring.keyframe_insert(data_path='rotation_euler', index=2, frame=1)
    ring.rotation_euler[2] += 0.28
    ring.keyframe_insert(data_path='rotation_euler', index=2, frame=288)

# A few small, slow-moving signal lights add depth without distracting from the message.
for i, (x,y,mat) in enumerate([(-8.0,3.8,MINT),(7.7,3.1,CYAN),(7.6,-3.7,VIOLET),(-7.6,-3.8,CYAN),(0,4.35,MINT)]):
    dot = circle(f'YS | Signal particle {i+1}', (x,y,-2.35), 0.035 if i%2 else 0.05, mat)
    dot.keyframe_insert(data_path='location', frame=1)
    dot.location.z = -1.9
    dot.keyframe_insert(data_path='location', frame=144)
    dot.location.z = -2.35
    dot.keyframe_insert(data_path='location', frame=288)

# Hero: custom shield-and-robot emblem, built from editable Blender geometry.
hero = group('YS | HERO — Shield Robot')
hero_center = (-5.4, 0.48)
shield_outline = [(-1.55,2.18),(0,2.72),(1.55,2.18),(1.48,0.22),(0.98,-1.15),(0,-2.12),(-0.98,-1.15),(-1.48,0.22)]
shield_abs = [(hero_center[0]+x, hero_center[1]+y) for x,y in shield_outline]
filled_polygon('YS | Shield inner enamel', shield_abs, SHIELD_FILL, -0.72, hero)
curve_line('YS | Luminous shield rim', [(x,y,-0.55) for x,y in shield_abs], CYAN, 0.065, hero, True)
inner = [(x*0.83+hero_center[0],y*0.83+hero_center[1]) for x,y in shield_outline]
curve_line('YS | Inner mint shield seam', [(x,y,-0.45) for x,y in inner], MUTED, 0.018, hero, True)

# Floating halo behind the shield.
bpy.ops.mesh.primitive_torus_add(major_radius=2.3, minor_radius=0.024, major_segments=96, minor_segments=8, location=(hero_center[0],hero_center[1]+0.15,-0.95))
halo=bpy.context.object; halo.name='YS | Shield halo'; halo.data.materials.append(MINT); parent_to(halo,hero)
halo.rotation_euler[2]=0
halo.keyframe_insert(data_path='rotation_euler',index=2,frame=1); halo.rotation_euler[2]=math.tau; halo.keyframe_insert(data_path='rotation_euler',index=2,frame=288)

# Rounded robot visor and face details.
rounded_box('YS | Robot visor', (hero_center[0],hero_center[1]+0.22,-0.20), (1.72,1.30,0.30), NAVY, 0.38, hero)
for eye_x in (-0.43,0.43):
    circle('YS | Robot eye', (hero_center[0]+eye_x,hero_center[1]+0.26,0.01), 0.16, MINT, hero, (0.78,1.0,0.55))
curve_line('YS | Robot smile', [(hero_center[0]-0.38,hero_center[1]-0.18,0.02),(hero_center[0]-0.16,hero_center[1]-0.30,0.02),(hero_center[0],hero_center[1]-0.33,0.02),(hero_center[0]+0.16,hero_center[1]-0.30,0.02),(hero_center[0]+0.38,hero_center[1]-0.18,0.02)], CYAN, 0.035, hero)
rounded_box('YS | Antenna stem', (hero_center[0],hero_center[1]+1.13,-0.10), (0.09,0.42,0.12), CYAN, 0.04, hero)
circle('YS | Antenna beacon', (hero_center[0],hero_center[1]+1.39,-0.04), 0.10, MINT, hero)
text_obj('YS | Mark', 'YS', (hero_center[0],hero_center[1]-1.05,0.05), 0.50, CYAN, align='CENTER', parent=hero)
animate_pop(hero, 1, 180, 0.001, 1.06)
hero.rotation_euler[2] = math.radians(-5)
hero.keyframe_insert(data_path='rotation_euler',index=2,frame=1)
hero.rotation_euler[2] = math.radians(0)
hero.keyframe_insert(data_path='rotation_euler',index=2,frame=34)
hero.rotation_euler[2] = math.radians(3)
hero.keyframe_insert(data_path='rotation_euler',index=2,frame=90)
hero.rotation_euler[2] = 0
hero.keyframe_insert(data_path='rotation_euler',index=2,frame=144)

# Hero titles and brand promise.
try:
    FONT_BOLD = bpy.data.fonts.load(r'C:\Windows\Fonts\arialbd.ttf')
    FONT_REG = bpy.data.fonts.load(r'C:\Windows\Fonts\arial.ttf')
except:
    FONT_BOLD = FONT_REG = None
intro = group('YS | HERO — Brand Copy')
text_obj('YS | Eyebrow', 'DISCORD SECURITY  /  MADE SIMPLE', (-2.45,2.32,0.3), 0.28, MINT, FONT_BOLD, parent=intro)
text_obj('YS | Main title', 'YS-BOT', (-2.55,1.10,0.34), 1.55, WHITE, FONT_BOLD, parent=intro, extrude=0.018)
text_obj('YS | Subtitle', 'Smart protection for your community', (-2.48,0.16,0.34), 0.43, CYAN, FONT_REG, parent=intro)
curve_line('YS | Title accent', [(-2.45,-0.27,0.30),(1.05,-0.27,0.30)], MINT, 0.027, intro)
text_obj('YS | Promise', 'SECURITY  •  MODERATION  •  COMMUNITY', (-2.45,-0.73,0.30), 0.255, MUTED, FONT_BOLD, parent=intro)
animate_pop(intro, 16, 182, 0.001, 1.035)

# Feature cards rise into view with small staggered entrances.
features = [
    ('01', 'ANTI-RAID', 'Calm control when things get busy', MINT),
    ('02', 'SMART MODERATION', 'Useful tools. Clear settings.', CYAN),
    ('03', 'COMMUNITY GAMES', 'Give your server more to do', VIOLET),
]
for idx, (number,title,desc,accent) in enumerate(features):
    card = group(f'YS | FEATURE {number} — {title}')
    x = -4.85 + idx*4.85
    rounded_box(f'YS | {title} glass card', (x,-3.42,-0.10), (4.45,1.30,0.22), PANEL, 0.20, card)
    rounded_box(f'YS | {title} accent', (x-1.98,-3.42,0.035), (0.055,0.77,0.06), accent, 0.025, card)
    text_obj(f'YS | {title} number', number, (x-1.75,-3.17,0.12), 0.20, accent, FONT_BOLD, parent=card)
    text_obj(f'YS | {title} title', title, (x-1.35,-3.17,0.12), 0.29, WHITE, FONT_BOLD, parent=card)
    text_obj(f'YS | {title} description', desc, (x-1.74,-3.67,0.12), 0.195, MUTED, FONT_REG, parent=card)
    card.location.y = -1.0
    card.keyframe_insert(data_path='location', frame=54+idx*8)
    card.location.y = 0
    card.keyframe_insert(data_path='location', frame=72+idx*8)
    card.keyframe_insert(data_path='location', frame=174)
    card.location.y = -0.7
    card.keyframe_insert(data_path='location', frame=185)
    card.scale=(1,1,1); card.keyframe_insert(data_path='scale',frame=54+idx*8)
    card.scale=(0.001,0.001,0.001); card.keyframe_insert(data_path='scale',frame=54+idx*8-1)
    card.scale=(1,1,1); card.keyframe_insert(data_path='scale',frame=72+idx*8)
    card.scale=(1,1,1); card.keyframe_insert(data_path='scale',frame=174)
    card.scale=(0.001,0.001,0.001); card.keyframe_insert(data_path='scale',frame=185)

# Call-to-action ending features the real supplied YS banner in a softly framed panel.
outro = group('YS | OUTRO — Website CTA')
rounded_box('YS | Outro backing', (0,0.18,-0.62), (14.7,6.05,0.26), PANEL, 0.36, outro)
try:
    image = bpy.data.images.load(ASSET_BANNER, check_existing=True)
    image.pack()
    banner_mat = bpy.data.materials.new('YS | Official brand banner')
    banner_mat.use_nodes=True
    banner_mat.surface_render_method='DITHERED'
    nodes=banner_mat.node_tree.nodes; nodes.clear()
    tex=nodes.new('ShaderNodeTexImage'); tex.image=image; tex.interpolation='Linear'
    em=nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value=0.86
    transparent=nodes.new('ShaderNodeBsdfTransparent')
    mix=nodes.new('ShaderNodeMixShader')
    out=nodes.new('ShaderNodeOutputMaterial')
    banner_mat.node_tree.links.new(tex.outputs['Color'],em.inputs['Color'])
    banner_mat.node_tree.links.new(tex.outputs['Alpha'],mix.inputs[0])
    banner_mat.node_tree.links.new(transparent.outputs[0],mix.inputs[1])
    banner_mat.node_tree.links.new(em.outputs[0],mix.inputs[2])
    banner_mat.node_tree.links.new(mix.outputs[0],out.inputs['Surface'])
    w,h=image.size
    aspect=w/max(h,1)
    plane_w=13.85; plane_h=plane_w/aspect
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0,0.30,-0.43))
    banner=bpy.context.object; banner.name='YS | Official banner image'
    banner.dimensions=(plane_w,plane_h,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    banner.data.materials.append(banner_mat)
    uv=banner.data.uv_layers.active
    if uv:
        for poly in banner.data.polygons:
            for loop_index in poly.loop_indices:
                vertex = banner.data.vertices[banner.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv=(vertex.x/plane_w+0.5, vertex.y/plane_h+0.5)
    parent_to(banner,outro)
except Exception as exc:
    print('Banner image skipped:', exc)
text_obj('YS | Outro URL', 'ys-bot.vercel.app', (0,-3.40,0.20), 0.54, MINT, FONT_BOLD, align='CENTER', parent=outro)
text_obj('YS | Outro tagline', 'PROTECT YOUR SERVER. KEEP YOUR COMMUNITY MOVING.', (0,-3.88,0.20), 0.22, WHITE, FONT_REG, align='CENTER', parent=outro)
rounded_box('YS | URL glow bar', (0,-4.22,-0.15), (3.20,0.035,0.035), MINT, 0.015, outro)
animate_pop(outro, 190, 320, 0.001, 1.025)

# Animated mini HUD accents around the ending card.
for i, x in enumerate((-7.8,7.8)):
    curve_line(f'YS | Outro HUD {i+1}', [(x,-1.0,-0.38),(x+(-0.48 if i==0 else 0.48),-1.0,-0.38),(x+(-0.48 if i==0 else 0.48),-1.7,-0.38)], CYAN, 0.018, outro)

# Lighting for subtle enamel reflections (Eevee material glow remains clean and graphic).
for name,loc,color,power,size in [
    ('YS | Mint softbox',(-5,3,7),(0.05,0.75,0.65),850,7),
    ('YS | Blue softbox',(4,2,5),(0.12,0.30,1.0),950,8),
    ('YS | Violet rim',(5,-4,4),(0.32,0.12,1.0),500,6),
]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light=bpy.context.object; light.name=name; light.data.energy=power; light.data.color=color; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(math.radians(15),0,math.radians(20))

# Smooth interpolation and a useful preview state for opening the editable project.
scene.frame_set(96)
bpy.context.view_layer.objects.active = cam
for obj in bpy.context.selected_objects: obj.select_set(False)
scene.render.filepath = VIDEO_PATH
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print('YS-Bot promo project saved to', BLEND_PATH)
print('Rendering 12-second promotional video to', VIDEO_PATH)
bpy.ops.render.render(animation=True)
print('YS-Bot promo video complete:', VIDEO_PATH)
